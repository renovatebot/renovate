import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { FlutterVersionDatasource } from './index.ts';

const baseUrl = 'https://storage.googleapis.com';
const urlPath = '/flutter_infra_release/releases/releases_linux.json';
const datasource = FlutterVersionDatasource.id;
const packageName = 'flutter';

describe('modules/datasource/flutter-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock.scope(baseUrl).get(urlPath).replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(200, { releases: [] });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(urlPath)
        .reply(200, Fixtures.get('index.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        releases: [
          {
            releaseTimestamp: '2021-07-27T21:03:05.871Z',
            isStable: false,
            version: '2.5.0-1.0.pre',
          },
          {
            isStable: false,
            version: '2.5.0-5.0.pre',
          },
          {
            isStable: false,
            version: '2.5.0-5.1.pre',
          },
          {
            isStable: false,
            version: '2.5.0-5.2.pre',
          },
          {
            isStable: false,
            version: '2.5.0-5.3.pre',
          },
          {
            isStable: false,
            version: '2.5.0-6.0.pre',
          },
          {
            isStable: true,
            version: '2.5.0',
          },
          {
            isStable: true,
            version: '2.5.1',
          },
          {
            isStable: true,
            version: '2.5.2',
          },
          {
            isStable: true,
            version: '2.5.3',
          },
          {
            isStable: false,
            version: '2.6.0-0.0.pre',
          },
          {
            isStable: false,
            version: '2.6.0-5.1.pre',
          },
          {
            isStable: false,
            version: '2.6.0-5.2.pre',
          },
          {
            isStable: false,
            version: '2.6.0-11.0.pre',
          },
          {
            isStable: false,
            version: '2.7.0-3.0.pre',
          },
          {
            isStable: false,
            version: '2.7.0-3.1.pre',
          },
          {
            isStable: false,
            version: '2.8.0-3.1.pre',
          },
          {
            isStable: false,
            version: '2.8.0-3.2.pre',
          },
          {
            isStable: false,
            version: '2.8.0-3.3.pre',
          },
          {
            isStable: true,
            version: '2.8.0',
          },
          {
            isStable: true,
            version: '2.8.1',
          },
          {
            isStable: false,
            version: '2.9.0-0.1.pre',
          },
          {
            isStable: false,
            version: '2.10.0-0.1.pre',
          },
          {
            isStable: false,
            version: '2.10.0-0.2.pre',
          },
          {
            isStable: false,
            version: '2.10.0-0.3.pre',
          },
          {
            isStable: true,
            version: '2.10.0',
          },
          {
            isStable: true,
            version: '2.10.1',
          },
          {
            isStable: true,
            version: '2.10.2',
          },
          {
            isStable: true,
            version: '2.10.3',
          },
          {
            isStable: false,
            version: '2.11.0-0.1.pre',
          },
          {
            isStable: false,
            version: '2.12.0-4.1.pre',
          },
        ],
      });
      expect(res?.releases).toHaveLength(31);
    });
  });
});
