import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import * as _hostRules from '../../util/host-rules';
import { GitHubReleaseMocker } from './test';
import { GithubReleasesDatasource } from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

const responseBody = [
  { tag_name: 'a', published_at: '2020-03-09T13:00:00Z' },
  { tag_name: 'v', published_at: '2020-03-09T12:00:00Z' },
  { tag_name: '1.0.0', published_at: '2020-03-09T11:00:00Z' },
  { tag_name: 'v1.1.0', draft: false, published_at: '2020-03-09T10:00:00Z' },
  { tag_name: '1.2.0', draft: true, published_at: '2020-03-09T10:00:00Z' },
  {
    tag_name: '2.0.0',
    published_at: '2020-04-09T10:00:00Z',
    prerelease: true,
  },
];

describe('datasource/github-releases/index', () => {
  const githubReleases = new GithubReleasesDatasource();

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
        datasource: GithubReleasesDatasource.id,
        depName: 'some/dep',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(
        res.releases.find((release) => release.version === 'v1.1.0')
      ).toBeDefined();
      expect(
        res.releases.find((release) => release.version === '1.2.0')
      ).toBeUndefined();
      expect(
        res.releases.find((release) => release.version === '2.0.0').isStable
      ).toBeFalse();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports ghe', async () => {
      const lookupName = 'some/dep';
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${lookupName}/releases?per_page=100`)
        .reply(200, responseBody);
      const res = await githubReleases.getReleases({
        registryUrl: 'https://git.enterprise.com',
        lookupName,
      });
      httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getDigest', () => {
    const depName = 'some/dep';
    const currentValue = 'v1.0.0';
    const currentDigest = 'v1.0.0-digest';

    const releaseMock = new GitHubReleaseMocker(githubApiHost, depName);

    it('requires currentDigest', async () => {
      const digest = await getDigest(
        { datasource: GithubReleasesDatasource.id, depName },
        currentValue
      );
      expect(digest).toBeNull();
    });

    it('defaults to currentDigest when currentVersion is missing', async () => {
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          depName,
          currentDigest,
        },
        currentValue
      );
      expect(digest).toEqual(currentDigest);
    });

    it('returns updated digest in new release', async () => {
      releaseMock.withDigestFileAsset(
        currentValue,
        `${currentDigest} asset.zip`
      );
      const nextValue = 'v1.0.1';
      const nextDigest = 'updated-digest';
      releaseMock.withDigestFileAsset(nextValue, `${nextDigest} asset.zip`);
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          depName,
          currentValue,
          currentDigest,
        },
        nextValue
      );
      expect(digest).toEqual(nextDigest);
    });

    // This is awkward, but I found returning `null` in this case to not produce an update
    // I'd prefer a PR with the old digest (that I can manually patch) to no PR, so I made this decision.
    it('ignores failures verifying currentDigest', async () => {
      releaseMock.release(currentValue);
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          depName,
          currentValue,
          currentDigest,
        },
        currentValue
      );
      expect(digest).toEqual(currentDigest);
    });
  });
});
