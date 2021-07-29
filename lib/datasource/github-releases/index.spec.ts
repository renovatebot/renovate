import fs from 'fs-extra';
import hasha from 'hasha';
import { DirectoryResult, dir } from 'tmp-promise';
import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as memCache from '../../util/cache/memory';
import * as packageCache from '../../util/cache/package';
import * as _hostRules from '../../util/host-rules';
import { id as datasource } from '.';
import * as github from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

const responseBody = [
  { tag_name: 'a', published_at: '2020-03-09T13:00:00Z' },
  { tag_name: 'v', published_at: '2020-03-09T12:00:00Z' },
  { tag_name: '1.0.0', published_at: '2020-03-09T11:00:00Z' },
  { tag_name: 'v1.1.0', published_at: '2020-03-09T10:00:00Z' },
  {
    tag_name: '2.0.0',
    published_at: '2020-04-09T10:00:00Z',
    prerelease: true,
  },
];

describe(getName(), () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getReleases', () => {
    it('returns releases', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/some/dep/releases?per_page=100')
        .reply(200, responseBody);

      const res = await getPkgReleases({
        datasource,
        depName: 'some/dep',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(
        res.releases.find((release) => release.version === 'v1.1.0')
      ).toBeDefined();
      expect(
        res.releases.find((release) => release.version === '2.0.0').isStable
      ).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports ghe', async () => {
      const lookupName = 'some/dep';
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${lookupName}/releases?per_page=100`)
        .reply(200, responseBody);
      const res = await github.getReleases({
        registryUrl: 'https://git.enterprise.com',
        lookupName,
      });
      httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getDigest', () => {
    const lookupName = 'some/dep';
    const currentValue = 'v1.0.0';
    const currentDigest = 'v1.0.0-digest';

    const mockReleaseWithAssets = (
      version: string,
      assets: { [key: string]: string }
    ) => {
      const releaseData = {
        tag_name: version,
        published_at: '2020-03-09T11:00:00Z',
        assets: [],
      };
      for (const assetFn of Object.keys(assets)) {
        const assetPath = `/repos/${lookupName}/releases/download/${version}/${assetFn}`;
        const assetData = assets[assetFn];
        releaseData.assets.push({
          name: assetFn,
          size: assetData.length,
          browser_download_url: `${githubApiHost}${assetPath}`,
        });
        httpMock
          .scope(githubApiHost)
          .get(assetPath)
          .once()
          .reply(200, assetData);
      }
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/releases/tags/${version}`)
        .reply(200, releaseData);
    };

    const mockReleaseWithDigestFile = (version: string, digests: string[]) => {
      mockReleaseWithAssets(version, { 'SHASUMS.txt': digests.join('\n') });
    };

    it('requires currentDigest', async () => {
      const digest = await getDigest({ datasource, lookupName }, currentValue);
      expect(digest).toBeNull();
    });

    it('defaults to currentDigest when currentVersion is missing', async () => {
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentDigest,
        },
        currentValue
      );
      expect(digest).toEqual(currentDigest);
    });

    it('verifies currentDigest from digest file', async () => {
      mockReleaseWithDigestFile(currentValue, [
        `${currentDigest} linux-amd64.tar.gz`,
        `another-digest   linux-arm64.tar.gz`,
      ]);
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        currentValue
      );
      expect(digest).toEqual(currentDigest);
    });

    // TODO: reviewers - this is awkward, but I found returning `null` in this case to not produce an update
    // I'd prefer a PR with the old digest (that I can manually patch) to no PR, so I made this decision.
    it('ignores failures verifying currentDigest', async () => {
      mockReleaseWithAssets(currentValue, {});
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        currentValue
      );
      expect(digest).toEqual(currentDigest);
    });

    it('parses digest file in new release', async () => {
      mockReleaseWithDigestFile(currentValue, [
        `${currentDigest} linux-amd64.tar.gz`,
        `another-digest   linux-arm64.tar.gz`,
      ]);
      const nextValue = 'v1.0.1';
      const nextDigest = 'v1.0.1-digest';
      mockReleaseWithDigestFile(nextValue, [
        `a-next-digest  linux-arm64.tar.gz`,
        `${nextDigest}  linux-amd64.tar.gz`,
      ]);
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        nextValue
      );
      expect(digest).toEqual(nextDigest);
    });

    it('returns null when new digest file is not found', async () => {
      mockReleaseWithDigestFile(currentValue, [
        `${currentDigest} linux-amd64.tar.gz`,
      ]);
      const nextValue = 'v1.0.1';
      const releaseData = {
        tag_name: nextValue,
        published_at: '2020-03-09T11:00:00Z',
        assets: [],
      };
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${lookupName}/releases/tags/${nextValue}`)
        .reply(200, releaseData);

      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        nextValue
      );
      expect(digest).toBeNull();
    });

    it('returns null when missing from new digest file', async () => {
      mockReleaseWithDigestFile(currentValue, [
        `${currentDigest} linux-amd64.tar.gz`,
      ]);
      const nextValue = 'v1.0.1';
      mockReleaseWithDigestFile(nextValue, []);
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        nextValue
      );
      expect(digest).toBeNull();
    });

    it('parses digest file in new release that embeds version in digested file', async () => {
      mockReleaseWithDigestFile(currentValue, [
        `${currentDigest} some-dep-1.0.0/linux-amd64.tar.gz`,
        `another-digest   some-dep-1.0.0/linux-arm64.tar.gz`,
      ]);
      const nextValue = 'v1.0.1';
      const nextDigest = 'v1.0.1-digest';
      mockReleaseWithDigestFile(nextValue, [
        `a-next-digest  some-dep-1.0.1/linux-arm64.tar.gz`,
        `${nextDigest}  some-dep-1.0.1/linux-amd64.tar.gz`,
      ]);
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest,
        },
        nextValue
      );
      expect(digest).toEqual(nextDigest);
    });

    it('verifies currentDigest from asset', async () => {
      const barContent = '1'.repeat(10 * 1024);
      mockReleaseWithAssets(currentValue, {
        'foo.txt': '0'.repeat(10 * 1024),
        'bar.txt': barContent,
      });

      const barDigest = await hasha.async(barContent, { algorithm: 'sha512' });
      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest: barDigest,
        },
        currentValue
      );
      expect(digest).toEqual(barDigest);
    });

    it('digests assets in new release', async () => {
      const barContent = '1'.repeat(10 * 1024);
      mockReleaseWithAssets(currentValue, {
        'foo.txt': '0'.repeat(8 * 1024),
        'bar.txt': barContent,
        'baz.txt': '2'.repeat(9 * 1024),
      });
      const barDigest = await hasha.async(barContent, { algorithm: 'sha256' });

      const nextValue = 'v1.0.1';
      const nextBarContent = '3'.repeat(10 * 1024);
      mockReleaseWithAssets(nextValue, {
        'bar.txt': nextBarContent,
      });

      const digest = await getDigest(
        {
          datasource,
          lookupName,
          currentValue,
          currentDigest: barDigest,
        },
        nextValue
      );
      const nextBarDigest = await hasha.async(nextBarContent, {
        algorithm: 'sha256',
      });
      expect(digest).toEqual(nextBarDigest);
    });

    describe('with cache', () => {
      let tmpDir: DirectoryResult;
      beforeEach(async () => {
        tmpDir = await dir();
        packageCache.init({ cacheDir: tmpDir.path });
        memCache.init();
      });

      afterEach(() => {
        fs.rmdirSync(tmpDir.path, { recursive: true });
      });

      it('caches digested assets', async () => {
        const barContent = '1'.repeat(10 * 1024);
        mockReleaseWithAssets(currentValue, {
          'bar.txt': barContent,
        });
        const algorithm = 'sha256';
        const barDigest = await hasha.async(barContent, { algorithm });

        for (const nextValue of ['v1.0.1', 'v1.0.2']) {
          const nextBarContent = '3'.repeat(10 * 1024);
          mockReleaseWithAssets(nextValue, {
            'bar.txt': nextBarContent,
          });

          const digest = await getDigest(
            {
              datasource,
              lookupName,
              currentValue,
              currentDigest: barDigest,
            },
            nextValue
          );
          const nextBarDigest = await hasha.async(nextBarContent, {
            algorithm,
          });
          expect(digest).toEqual(nextBarDigest);
        }
        // `currentValue` assets were only mocked once, therefore asset digests were cached
      });
    });
  });
});
