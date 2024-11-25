import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { BuildpacksRegistryDatasource } from '.';

const baseUrl = 'https://registry.buildpacks.io/api/v1/buildpacks/';

describe('modules/datasource/buildpacks-registry/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/heroku/python')
        .reply(200, Fixtures.get('heroku-python.json'));
      const res = await getPkgReleases({
        datasource: BuildpacksRegistryDatasource.id,
        packageName: 'heroku/python',
      });
      expect(res).toMatchSnapshot();
    });
  });
});
