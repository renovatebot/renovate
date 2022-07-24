import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { GitTagsDatasource } from '../git-tags';
import { BaseGoDatasource } from './base';
import { GoDirectDatasource } from './releases-direct';

jest.mock('../../../util/host-rules');
jest.mock('./base');

const datasource = new GoDirectDatasource();
const getDatasourceSpy = jest.spyOn(BaseGoDatasource, 'getDatasource');
const hostRules = mocked(_hostRules);

describe('modules/datasource/go/releases-direct', () => {
  const gitGetTags = jest.spyOn(GitTagsDatasource.prototype, 'getReleases');

  beforeEach(() => {
    jest.resetAllMocks();
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
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
        })
      ).rejects.toThrow();
    });

    it('processes real data', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'golang/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/golang/text',
      });
      gitGetTags.mockResolvedValueOnce({
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
        repoRoot: 'https://gitlab.com/golang/text',
      });
      gitGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });
      const res = await datasource.getReleases({
        packageName: 'golang.org/x/text',
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
        repoRoot: 'https://my.custom.domain/golang/myrepo',
      });
      hostRules.find.mockReturnValue({ token: 'some-token' });
      gitGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });
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
        repoRoot: 'https://bitbucket.org/golang/text',
      });
      gitGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
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
        repoRoot: 'https://git.enterprise.com/example/module',
      });
      gitGetTags.mockResolvedValueOnce({
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
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/v' },
            packageName: 'https://git.enterprise.com/example/module',
          },
        ],
      ]);
    });

    it('works for known servers', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'go-x/x',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/go-x/x',
      });
      gitGetTags.mockResolvedValue({ releases: [] });
      const packages = [
        { packageName: 'github.com/x/text' },
        { packageName: 'gopkg.in/x/text' },
        { packageName: 'gopkg.in/x' },
      ];
      for (const pkg of packages) {
        const res = await datasource.getReleases(pkg);
        expect(res?.releases).toBeEmpty();
      }
      expect(gitGetTags).toHaveBeenCalledTimes(3);
    });

    it('support gitlab subgroups', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        packageName: 'group/subgroup/repo',
        repoRoot: 'https://gitlab.com/group/subgroup/repo',
      });
      gitGetTags.mockResolvedValue({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });
      const res = await datasource.getReleases({
        packageName: 'gitlab.com/group/subgroup/repo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/v' },
            packageName: 'https://gitlab.com/group/subgroup/repo',
          },
        ],
      ]);
    });

    it('support nested modules on gitlab subgroups', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        packageName: 'group/subgroup/repo',
        repoRoot: 'https://gitlab.com/group/subgroup/repo',
      });
      gitGetTags.mockResolvedValue({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v2.0.0', version: 'v2.0.0' },
        ],
      });
      const res = await datasource.getReleases({
        packageName: 'gitlab.com/group/subgroup/repo/submodule',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/submodule/v' },
            packageName: 'https://gitlab.com/group/subgroup/repo',
          },
        ],
      ]);
    });

    it('works for nested modules on github', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      const packages = [
        { packageName: 'github.com/x/text/a' },
        { packageName: 'github.com/x/text/b' },
      ];

      gitGetTags
        .mockResolvedValueOnce({
          releases: [{ version: 'a/v1.0.0', gitRef: 'a/v1.0.0' }],
        })
        .mockResolvedValueOnce({
          releases: [{ version: 'b/v2.0.0', gitRef: 'b/v2.0.0' }],
        });

      for (const pkg of packages) {
        const prefix = pkg.packageName.split('/')[3];
        const result = await datasource.getReleases(pkg);
        expect(result?.releases).toHaveLength(1);
        expect(result?.releases[0].version.startsWith(prefix)).toBeFalse();
      }
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/a/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
        [
          {
            filter: { prefix: 'refs/tags/b/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
      ]);
    });

    it('returns none if no tags match submodules', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      const packages = [
        { packageName: 'github.com/x/text/a' },
        { packageName: 'github.com/x/text/b' },
      ];

      gitGetTags
        .mockResolvedValueOnce({
          releases: [],
        })
        .mockResolvedValueOnce({
          releases: [],
        });

      for (const pkg of packages) {
        const result = await datasource.getReleases(pkg);
        expect(result?.releases).toHaveLength(0);
      }
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/a/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
        [
          {
            filter: { prefix: 'refs/tags/b/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
      ]);
    });

    it('works for modules on github v2+ major upgrades', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      const pkg = { packageName: 'github.com/x/text/v2' };

      gitGetTags.mockResolvedValue({
        releases: [
          { version: 'v2.0.0', gitRef: 'v2.0.0' },
          { version: 'v3.0.0', gitRef: 'v3.0.0' },
        ],
      });

      const result = await datasource.getReleases(pkg);
      expect(result?.releases).toEqual([
        { version: 'v2.0.0', gitRef: 'v2.0.0' },
        { version: 'v3.0.0', gitRef: 'v3.0.0' },
      ]);
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
      ]);
    });

    it('works for nested modules on github v2+ major upgrades', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        packageName: 'x/text',
        registryUrl: 'https://github.com',
        repoRoot: 'https://github.com/x/text',
      });
      const pkg = { packageName: 'github.com/x/text/b/v2' };

      gitGetTags.mockResolvedValue({
        releases: [
          { version: 'b/v2.0.0', gitRef: 'b/v2.0.0' },
          { version: 'b/v3.0.0', gitRef: 'b/v3.0.0' },
        ],
      });

      const result = await datasource.getReleases(pkg);
      expect(result?.releases).toEqual([
        { version: 'v2.0.0', gitRef: 'b/v2.0.0' },
        { version: 'v3.0.0', gitRef: 'b/v3.0.0' },
      ]);
      expect(gitGetTags.mock.calls).toMatchObject([
        [
          {
            filter: { prefix: 'refs/tags/b/v' },
            packageName: 'https://github.com/x/text',
          },
        ],
      ]);
    });
  });
});
