import * as httpMock from '../../../test/http-mock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { BaseGoDatasource } from './base';
import { GoDirectDatasource } from './releases-direct';

jest.mock('../../util/host-rules');
jest.mock('./base');

const datasource = new GoDirectDatasource();
const getDatasourceSpy = jest.spyOn(BaseGoDatasource, 'getDatasource');
const hostRules = mocked(_hostRules);

describe('datasource/go/releases-direct', () => {
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
        lookupName: 'golang.org/foo/something',
      });
      expect(res).toBeNull();
    });
    it('throws for getDatasource error', async () => {
      getDatasourceSpy.mockRejectedValueOnce(new Error('unknown'));
      await expect(
        datasource.getReleases({
          lookupName: 'golang.org/foo/something',
        })
      ).rejects.toThrow();
    });
    it('processes real data', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'golang/text',
        registryUrl: 'https://github.com',
      });
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/golang/text/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }])
        .get('/repos/golang/text/releases?per_page=100')
        .reply(200, []);
      const res = await datasource.getReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support gitlab', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        lookupName: 'golang/text',
      });
      httpMock
        .scope('https://gitlab.com/')
        .get('/api/v4/projects/golang%2Ftext/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        lookupName: 'golang.org/x/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support self hosted gitlab private repositories', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://my.custom.domain',
        lookupName: 'golang/myrepo',
      });
      hostRules.find.mockReturnValue({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get('/api/v4/projects/golang%2Fmyrepo/repository/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        lookupName: 'my.custom.domain/golang/myrepo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support bitbucket tags', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'bitbucket-tags',
        lookupName: 'golang/text',
        registryUrl: 'https://bitbucket.org',
      });
      httpMock
        .scope('https://api.bitbucket.org/')
        .get('/2.0/repositories/golang/text/refs/tags')
        .reply(200, {
          pagelen: 2,
          page: 1,
          values: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
        });
      const res = await datasource.getReleases({
        lookupName: 'bitbucket.org/golang/text',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support ghe', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        registryUrl: 'https://git.enterprise.com',
        lookupName: 'example/module',
      });
      httpMock
        .scope('https://git.enterprise.com/')
        .get('/api/v3/repos/example/module/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }])
        .get('/api/v3/repos/example/module/releases?per_page=100')
        .reply(200, []);
      const res = await datasource.getReleases({
        lookupName: 'git.enterprise.com/example/module',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('works for known servers', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'go-x/x',
        registryUrl: 'https://github.com',
      });
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, [])
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, [])
        .get('/repos/go-x/x/tags?per_page=100')
        .reply(200, [])
        .get('/repos/go-x/x/releases?per_page=100')
        .reply(200, []);
      const packages = [
        { lookupName: 'github.com/x/text' },
        { lookupName: 'gopkg.in/x/text' },
        { lookupName: 'gopkg.in/x' },
      ];
      for (const pkg of packages) {
        const res = await datasource.getReleases(pkg);
        expect(res.releases).toBeEmpty();
      }
      const httpCalls = httpMock.getTrace();
      expect(httpCalls).toHaveLength(6);
      expect(httpCalls).toMatchSnapshot();
    });
    it('support gitlab subgroups', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'gitlab-tags',
        registryUrl: 'https://gitlab.com',
        lookupName: 'group/subgroup/repo',
      });
      httpMock
        .scope('https://gitlab.com/')
        .get(
          '/api/v4/projects/group%2Fsubgroup%2Frepo/repository/tags?per_page=100'
        )
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]);
      const res = await datasource.getReleases({
        lookupName: 'gitlab.com/group/subgroup/repo',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('works for nested modules on github', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];
      const tags = [{ name: 'a/v1.0.0' }, { name: 'b/v2.0.0' }];

      for (const pkg of packages) {
        httpMock
          .scope('https://api.github.com/')
          .get('/repos/x/text/tags?per_page=100')
          .reply(200, tags)
          .get('/repos/x/text/releases?per_page=100')
          .reply(200, []);

        const prefix = pkg.lookupName.split('/')[3];
        const result = await datasource.getReleases(pkg);
        expect(result.releases).toHaveLength(1);
        expect(result.releases[0].version.startsWith(prefix)).toBeFalse();

        const httpCalls = httpMock.getTrace();
        expect(httpCalls).toMatchSnapshot();
        httpMock.clear();
      }
    });
    it('returns none if no tags match submodules', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      const packages = [
        { lookupName: 'github.com/x/text/a' },
        { lookupName: 'github.com/x/text/b' },
      ];
      const tags = [{ name: 'v1.0.0' }, { name: 'v2.0.0' }];

      for (const pkg of packages) {
        httpMock
          .scope('https://api.github.com/')
          .get('/repos/x/text/tags?per_page=100')
          .reply(200, tags)
          .get('/repos/x/text/releases?per_page=100')
          .reply(200, []);

        const result = await datasource.getReleases(pkg);
        expect(result.releases).toHaveLength(0);

        const httpCalls = httpMock.getTrace();
        expect(httpCalls).toMatchSnapshot();
        httpMock.clear();
      }
    });
    it('works for nested modules on github v2+ major upgrades', async () => {
      getDatasourceSpy.mockResolvedValueOnce({
        datasource: 'github-tags',
        lookupName: 'x/text',
        registryUrl: 'https://github.com',
      });
      const pkg = { lookupName: 'github.com/x/text/b/v2' };
      const tags = [
        { name: 'a/v1.0.0' },
        { name: 'v5.0.0' },
        { name: 'b/v2.0.0' },
        { name: 'b/v3.0.0' },
      ];

      httpMock
        .scope('https://api.github.com/')
        .get('/repos/x/text/tags?per_page=100')
        .reply(200, tags)
        .get('/repos/x/text/releases?per_page=100')
        .reply(200, []);

      const result = await datasource.getReleases(pkg);
      expect(result.releases).toEqual([
        { gitRef: 'b/v2.0.0', version: 'v2.0.0' },
        { gitRef: 'b/v3.0.0', version: 'v3.0.0' },
      ]);

      const httpCalls = httpMock.getTrace();
      expect(httpCalls).toMatchSnapshot();
    });
  });
});
