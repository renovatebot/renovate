import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DotnetSdkDatasource } from '.';

const releasesIndex = Fixtures.getJson('releases-index.json');
const releases7_0 = Fixtures.getJson('releases-7.0.json');
const releases6_0 = Fixtures.getJson('releases-6.0.json');
const releases5_0 = Fixtures.getJson('releases-5.0.json');
const releases3_1 = Fixtures.getJson('releases-3.1.json');

const baseUrl =
  'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata';

describe('modules/datasource/dotnet-sdk/index', () => {
  describe('getReleases', () => {
    afterEach(() => httpMock.clear(false));

    it('returns null for 404 for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').reply(404);

      expect(
        await getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).toBeNull();
    });

    it('returns null for 404 for version', async () => {
      httpMock
        .scope(baseUrl)
        .get('/releases-index.json')
        .reply(200, releasesIndex)
        .get('/7.0/releases.json')
        .reply(404);

      expect(
        await getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).toBeNull();
    });

    it('throws for 5xx for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').reply(502);

      await expect(
        getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx for for version', async () => {
      httpMock
        .scope(baseUrl)
        .get('/releases-index.json')
        .reply(200, releasesIndex)
        .get('/7.0/releases.json')
        .reply(502)
        .get('/6.0/releases.json')
        .reply(502)
        .get('/5.0/releases.json')
        .reply(502)
        .get('/3.1/releases.json')
        .reply(502);

      await expect(
        getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').replyWithError('');

      expect(
        await getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).toBeNull();
    });

    it('returns null for unknown error for version', async () => {
      httpMock
        .scope(baseUrl)
        .get('/releases-index.json')
        .reply(200, releasesIndex)
        .get('/7.0/releases.json')
        .replyWithError('');

      expect(
        await getPkgReleases({
          datasource: DotnetSdkDatasource.id,
          depName: 'dotnet-sdk',
        })
      ).toBeNull();
    });

    it('returns real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/releases-index.json')
        .reply(200, releasesIndex)
        .get('/7.0/releases.json')
        .reply(200, releases7_0)
        .get('/6.0/releases.json')
        .reply(200, releases6_0)
        .get('/5.0/releases.json')
        .reply(200, releases5_0)
        .get('/3.1/releases.json')
        .reply(200, releases3_1);

      const res = await getPkgReleases({
        datasource: DotnetSdkDatasource.id,
        depName: 'dotnet-sdk',
      });
      expect(res).toBeDefined();
    });
  });
});
