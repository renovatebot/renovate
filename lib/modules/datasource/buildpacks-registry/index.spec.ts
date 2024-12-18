import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { BuildpacksRegistryDatasource } from '.';

const baseUrl = 'https://registry.buildpacks.io/api/v1/buildpacks/';

describe('modules/datasource/buildpacks-registry/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/heroku/python')
        .reply(200, {
          latest: {
            version: '0.17.1',
            namespace: 'heroku',
            name: 'python',
            description: "Heroku's buildpack for Python applications.",
            homepage: 'https://github.com/heroku/buildpacks-python',
            licenses: ['BSD-3-Clause'],
            stacks: ['*'],
            id: '75946bf8-3f6a-4af0-a757-614bebfdfcd6',
          },
          versions: [
            {
              version: '0.17.1',
              _link:
                'https://registry.buildpacks.io//api/v1/buildpacks/heroku/python/0.17.1',
            },
            {
              version: '0.17.0',
              _link:
                'https://registry.buildpacks.io//api/v1/buildpacks/heroku/python/0.17.0',
            },
          ],
        });
      const res = await getPkgReleases({
        datasource: BuildpacksRegistryDatasource.id,
        packageName: 'heroku/python',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.buildpacks.io',
        releases: [{ version: '0.17.0' }, { version: '0.17.1' }],
        sourceUrl: 'https://github.com/heroku/buildpacks-python',
      });
    });

    it('returns null on empty result', async () => {
      httpMock.scope(baseUrl).get('/heroku/empty').reply(200, {});
      const res = await getPkgReleases({
        datasource: BuildpacksRegistryDatasource.id,
        packageName: 'heroku/empty',
      });
      expect(res).toBeNull();
    });

    it('handles not found', async () => {
      httpMock.scope(baseUrl).get('/heroku/notexisting').reply(404);
      const res = await getPkgReleases({
        datasource: BuildpacksRegistryDatasource.id,
        packageName: 'heroku/notexisting',
      });
      expect(res).toBeNull();
    });
  });
});
