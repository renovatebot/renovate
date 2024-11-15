import { mockDeep } from 'jest-mock-extended';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { GitTagsDatasource } from '../git-tags';
import { GithubTagsDatasource } from '../github-tags';
import { BaseGoDatasource } from './base';
import { GoDirectDatasource } from './releases-direct';

jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('./base');

const datasource = new GoDirectDatasource();
const getDatasourceSpy = jest.spyOn(BaseGoDatasource, 'getDatasource');
const hostRules = mocked(_hostRules);

describe('modules/datasource/go/releases-direct', () => {
  const gitGetTags = jest.spyOn(GitTagsDatasource.prototype, 'getReleases');
  const githubGetTags = jest.spyOn(
    GithubTagsDatasource.prototype,
    'getReleases',
  );

  beforeEach(() => {
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  describe('getReleases', () => {
    it('returns null for null getDatasource result', async () => {
      getDatasourceSpy.mockResolvedValueOnce(null);
      const res = await datasource.getReleases({
        packageName: 'golang.org/foo/something',
      });
      expect(res).toBeNull();
    });

    it('throws for getDatasource error', async () => {
      getDatasourceSpy.mockRejectedValueOnce(new Error('unknown'));
      await expect(
        datasource.getReleases({
          packageName: 'golang.org/foo/something',
        }),
      ).rejects.toThrow();
    });

    it('processes real data', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'golang/text',
        registryUrl: 'https://github.com',
      });
      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });

      const res = await datasource.getReleases({
        packageName: 'golang.org/x/text',
      });

      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
        sourceUrl: 'https://github.com/golang/text',
      });
    });

    it('support gitlab', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        packageName: 'golang/text',
      });
      httpMock
        .scope('https://gitlab.com/')
        .get('/api/v4/projects/golang%2Ftext/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        packageName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('support gitea', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitea-tags',
        registryUrl: 'https://gitea.com',
        packageName: 'go-chi/cache',
      });
      httpMock
        .scope('https://gitea.com/')
        .get('/api/v1/repos/go-chi/cache/tags')
        .reply(200, [
          {
            name: 'v0.1.0',
            commit: {
              sha: 'd73d815ec22c421e7192a414594ac798c73c89e5',
              created: '2022-05-15T16:29:42Z',
            },
          },
          {
            name: 'v0.2.0',
            commit: {
              sha: '3976707232cb68751ff2ddf42547ff95c6878a97',
              created: '2022-05-15T17:23:28Z',
            },
          },
          {
            name: 'v0.2.1',
            commit: {
              sha: '2963b104773ead7ed28c00181c03318885d909dc',
              created: '2024-09-06T23:44:34Z',
            },
          },
        ]);
      const res = await datasource.getReleases({
        packageName: 'gitea.com/go-chi/cache',
      });
      expect(res).toEqual({
        registryUrl: 'https://gitea.com',
        releases: [
          {
            gitRef: 'v0.1.0',
            newDigest: 'd73d815ec22c421e7192a414594ac798c73c89e5',
            releaseTimestamp: '2022-05-15T16:29:42Z',
            version: 'v0.1.0',
          },
          {
            gitRef: 'v0.2.0',
            newDigest: '3976707232cb68751ff2ddf42547ff95c6878a97',
            releaseTimestamp: '2022-05-15T17:23:28Z',
            version: 'v0.2.0',
          },
          {
            gitRef: 'v0.2.1',
            newDigest: '2963b104773ead7ed28c00181c03318885d909dc',
            releaseTimestamp: '2024-09-06T23:44:34Z',
            version: 'v0.2.1',
          },
        ],
        sourceUrl: null,
      });
    });

    it('support git', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'git-tags',
        packageName: 'renovatebot.com/abc/def',
      });
      gitGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });
      const res = await datasource.getReleases({
        packageName: 'renovatebot.com/abc/def',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('support self hosted gitlab private repositories', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://my.custom.domain',
        packageName: 'golang/myrepo',
      });
      hostRules.find.mockReturnValue({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get('/api/v4/projects/golang%2Fmyrepo/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        packageName: 'my.custom.domain/golang/myrepo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('support bitbucket tags', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'bitbucket-tags',
        packageName: 'golang/text',
        registryUrl: 'https://bitbucket.org',
      });
      httpMock
        .scope('https://api.bitbucket.org/')
        .get('/2.0/repositories/golang/text/refs/tags?pagelen=100')
        .reply(200, {
          pagelen: 2,
          page: 1,
          values: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
        });
      const res = await datasource.getReleases({
        packageName: 'bitbucket.org/golang/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('support ghe', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        registryUrl: 'https://git.enterprise.com',
        packageName: 'example/module',
      });
      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });

      const res = await datasource.getReleases({
        packageName: 'git.enterprise.com/example/module',
      });

      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
        sourceUrl: 'https://git.enterprise.com/example/module',
      });
      expect(githubGetTags.mock.calls).toMatchObject([
        [{ registryUrl: 'https://git.enterprise.com' }],
      ]);
    });

    it('works for known servers', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'go-x/x',
        registryUrl: 'https://github.com',
      });
      githubGetTags.mockResolvedValue({ releases: [] });
      const packages = [
        { packageName: 'github.com/x/text' },
        { packageName: 'gopkg.in/x/text' },
        { packageName: 'gopkg.in/x' },
      ];
      for (const pkg of packages) {
        const res = await datasource.getReleases(pkg);
        expect(res?.releases).toBeEmpty();
      }
      expect(githubGetTags).toHaveBeenCalledTimes(3);
    });

    it('support gitlab subgroups', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        packageName: 'group/subgroup/repo',
      });
      httpMock
        .scope('https://gitlab.com/')
        .get(
          '/api/v4/projects/group%2Fsubgroup%2Frepo/repository/tags?per_page=100',
        )
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        packageName: 'gitlab.com/group/subgroup/repo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('works for nested modules on github', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      const packages = [
        { packageName: 'github.com/x/text/a' },
        { packageName: 'github.com/x/text/b' },
      ];

      githubGetTags.mockResolvedValue({
        releases: [
          { version: 'a/v1.0.0', gitRef: 'a/v1.0.0' },
          { version: 'b/v2.0.0', gitRef: 'b/v2.0.0' },
        ],
      });

      for (const pkg of packages) {
        const prefix = pkg.packageName.split('/')[3];
        const result = await datasource.getReleases(pkg);
        expect(result?.releases).toHaveLength(1);
        expect(result?.releases[0].version.startsWith(prefix)).toBeFalse();
      }
    });

    it('falls back to unprefixed tags', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });

      const releases = [
        { version: 'v1.0.0', gitRef: 'v1.0.0' },
        { version: 'v2.0.0', gitRef: 'v2.0.0' },
      ];
      githubGetTags.mockResolvedValue({ releases });

      await expect(
        datasource.getReleases({ packageName: 'github.com/x/text/a' }),
      ).resolves.toEqual({ releases, sourceUrl: 'https://github.com/x/text' });
      await expect(
        datasource.getReleases({ packageName: 'github.com/x/text/b' }),
      ).resolves.toEqual({ releases, sourceUrl: 'https://github.com/x/text' });
    });

    it('works for nested modules on github v2+ major upgrades', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
      });
      const pkg = { packageName: 'github.com/x/text/b/v2' };

      githubGetTags.mockResolvedValue({
        releases: [
          { version: 'a/v1.0.0', gitRef: 'a/v1.0.0' },
          { version: 'v5.0.0', gitRef: 'v5.0.0' },
          { version: 'b/v2.0.0', gitRef: 'b/v2.0.0' },
          { version: 'b/v3.0.0', gitRef: 'b/v3.0.0' },
          { version: 'b/vuw/xyz', gitRef: 'b/vuw/xyz' },
        ],
      });

      const result = await datasource.getReleases(pkg);
      expect(result?.releases).toEqual([
        { version: 'v2.0.0', gitRef: 'b/v2.0.0' },
        { version: 'v3.0.0', gitRef: 'b/v3.0.0' },
      ]);
    });
  });
});
