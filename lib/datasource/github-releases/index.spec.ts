import fs from 'fs-extra';
import hasha from 'hasha';
import { DirectoryResult, dir } from 'tmp-promise';
import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as memCache from '../../util/cache/memory';
import * as packageCache from '../../util/cache/package';
import * as _hostRules from '../../util/host-rules';
import { GitHubReleaseMocker } from './__testutil__';
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

    const releaseMock = new GitHubReleaseMocker(githubApiHost, lookupName);

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

    // TODO: reviewers - this is awkward, but I found returning `null` in this case to not produce an update
    // I'd prefer a PR with the old digest (that I can manually patch) to no PR, so I made this decision.
    it('ignores failures verifying currentDigest', async () => {
      releaseMock.release(currentValue);
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
        releaseMock.withAssets(currentValue, {
          'bar.txt': barContent,
        });
        const algorithm = 'sha256';
        const barDigest = await hasha.async(barContent, { algorithm });

        for (const nextValue of ['v1.0.1', 'v1.0.2']) {
          const nextBarContent = '3'.repeat(10 * 1024);
          releaseMock.withAssets(nextValue, {
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
