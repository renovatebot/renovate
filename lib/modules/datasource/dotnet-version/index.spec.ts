import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DotnetVersionDatasource } from '.';

const releasesIndex = Fixtures.getJson('releases-index.json');
const releases7_0 = Fixtures.getJson('releases-7.0.json');
const releases6_0 = Fixtures.getJson('releases-6.0.json');
const releases5_0 = Fixtures.getJson('releases-5.0.json');
const releases3_1 = Fixtures.getJson('releases-3.1.json');

const baseUrl =
  'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata';

describe('modules/datasource/dotnet-version/index', () => {
  describe('getReleases', () => {
    it('returns null for non-dotnet package', async () => {
      expect(
        await getPkgReleases({
          datasource: DotnetVersionDatasource.id,
          packageName: 'non-dotnet',
        }),
      ).toBeNull();
    });

    it('returns null for 404 for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').reply(404);

      expect(
        await getPkgReleases({
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
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
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
      ).toBeNull();
    });

    it('throws for 5xx for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').reply(502);

      await expect(
        getPkgReleases({
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx for version', async () => {
      httpMock
        .scope(baseUrl)
        .get('/releases-index.json')
        .reply(200, releasesIndex)
        .get('/7.0/releases.json')
        .reply(502);

      await expect(
        getPkgReleases({
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error for index', async () => {
      httpMock.scope(baseUrl).get('/releases-index.json').replyWithError('');

      expect(
        await getPkgReleases({
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
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
          datasource: DotnetVersionDatasource.id,
          packageName: 'dotnet-sdk',
        }),
      ).toBeNull();
    });

    it('returns real data for sdk', async () => {
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
        datasource: DotnetVersionDatasource.id,
        packageName: 'dotnet-sdk',
      });

      expect(res).toBeDefined();
      expect(res?.sourceUrl).toBe('https://github.com/dotnet/sdk');
      expect(res?.releases).toHaveLength(19);
      expect(res?.releases).toIncludeAllPartialMembers([
        {
          version: '3.1.100-preview1-014459',
          releaseTimestamp: '2019-10-15T00:00:00.000Z',
        },
        { version: '3.1.423', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        {
          version: '5.0.100-preview.1.20155.7',
          releaseTimestamp: '2020-03-16T00:00:00.000Z',
        },
        { version: '5.0.408', releaseTimestamp: '2022-05-10T00:00:00.000Z' },
        {
          version: '6.0.100-preview.1.21103.13',
          releaseTimestamp: '2021-02-17T00:00:00.000Z',
        },
        { version: '6.0.401', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        { version: '6.0.304', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        { version: '6.0.109', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        {
          version: '7.0.100-preview.1.22110.4',
          releaseTimestamp: '2022-02-17T00:00:00.000Z',
        },
        {
          version: '7.0.100-rc.1.22431.12',
          releaseTimestamp: '2022-09-14T00:00:00.000Z',
        },
      ]);
    });

    it('returns real data for runtime', async () => {
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
        datasource: DotnetVersionDatasource.id,
        packageName: 'dotnet-runtime',
      });

      expect(res).toBeDefined();
      expect(res?.sourceUrl).toBe('https://github.com/dotnet/runtime');
      expect(res?.releases).toHaveLength(17);
      expect(res?.releases).toIncludeAllPartialMembers([
        {
          version: '3.1.0-preview1.19506.1',
          releaseTimestamp: '2019-10-15T00:00:00.000Z',
        },
        { version: '3.1.29', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        {
          version: '5.0.0-preview.1.20120.5',
          releaseTimestamp: '2020-03-16T00:00:00.000Z',
        },
        { version: '5.0.17', releaseTimestamp: '2022-05-10T00:00:00.000Z' },
        {
          version: '6.0.0-preview.1.21102.12',
          releaseTimestamp: '2021-02-17T00:00:00.000Z',
        },
        { version: '6.0.9', releaseTimestamp: '2022-09-13T00:00:00.000Z' },
        {
          version: '7.0.0-preview.1.22076.8',
          releaseTimestamp: '2022-02-17T00:00:00.000Z',
        },
        {
          version: '7.0.0-rc.1.22426.10',
          releaseTimestamp: '2022-09-14T00:00:00.000Z',
        },
      ]);
    });
  });
});
