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

    it('returns none if no tags match submodules', async () => {
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
          { version: 'v1.0.0', gitRef: 'v1.0.0' },
          { version: 'v2.0.0', gitRef: 'v2.0.0' },
        ],
      });

      for (const pkg of packages) {
        const result = await datasource.getReleases(pkg);
        expect(result?.releases).toHaveLength(0);
      }
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
