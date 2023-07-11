import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { AzureTagsDatasource } from '.';

const datasource = AzureTagsDatasource.id;

describe('modules/datasource/azure-tags/index', () => {
  describe('getReleases', () => {
    it('returns tags from Azure DevOps', async () => {
      const body = {
        count: 3,
        value: [
          {
            name: 'refs/tags/1.0.0',
          },
          {
            name: 'refs/tags/1.1.0',
          },
          {
            name: 'refs/tags/1.1.1',
          },
        ],
      };
      httpMock
        .scope('https://dev.azure.com')
        .get(
          '/my-organization/my-project/_apis/git/repositories/my-repo/refs?filter=tags&$top=100&api-version=7.0'
        )
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'my-repo',
        registryUrls: ['https://dev.azure.com/my-organization/my-project'],
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(3);
    });
  });
});
