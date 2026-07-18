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
      expect(res).toEqual({
        homepage: 'https://flutter.dev',
        registryUrl: 'https://storage.googleapis.com',
        releases: [
          {
            isStable: false,
            releaseTimestamp: '2021-07-27T21:03:05.871Z',
            version: '2.5.0-1.0.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-08-05T18:54:18.003Z',
            version: '2.5.0-5.0.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-08-12T00:33:41.428Z',
            version: '2.5.0-5.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-08-19T18:36:51.976Z',
            version: '2.5.0-5.2.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-09-02T17:36:07.377Z',
            version: '2.5.0-5.3.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-08-12T23:48:47.162Z',
            version: '2.5.0-6.0.pre',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-09-08T15:47:00.801Z',
            version: '2.5.0',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-09-17T21:54:22.188Z',
            version: '2.5.1',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-09-30T23:48:47.983Z',
            version: '2.5.2',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-10-15T20:49:17.899Z',
            version: '2.5.3',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-08-26T00:01:48.631Z',
            version: '2.6.0-0.0.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-09-13T19:01:48.167Z',
            version: '2.6.0-5.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-09-16T01:31:55.213Z',
            version: '2.6.0-5.2.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-09-25T04:23:04.133Z',
            version: '2.6.0-11.0.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-10-20T15:31:44.689Z',
            version: '2.7.0-3.0.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-10-28T01:23:19.625Z',
            version: '2.7.0-3.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-11-12T22:37:32.489Z',
            version: '2.8.0-3.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-11-18T19:56:24.033Z',
            version: '2.8.0-3.2.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-12-01T23:27:03.890Z',
            version: '2.8.0-3.3.pre',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-12-09T01:20:18.536Z',
            version: '2.8.0',
          },
          {
            isStable: true,
            releaseTimestamp: '2021-12-16T19:49:49.658Z',
            version: '2.8.1',
          },
          {
            isStable: false,
            releaseTimestamp: '2021-12-15T00:49:29.119Z',
            version: '2.9.0-0.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2022-01-12T20:49:45.416Z',
            version: '2.10.0-0.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2022-01-20T21:48:07.280Z',
            version: '2.10.0-0.2.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2022-01-27T01:12:24.134Z',
            version: '2.10.0-0.3.pre',
          },
          {
            isStable: true,
            releaseTimestamp: '2022-02-03T16:29:13.224Z',
            version: '2.10.0',
          },
          {
            isStable: true,
            releaseTimestamp: '2022-02-10T01:18:38.655Z',
            version: '2.10.1',
          },
          {
            isStable: true,
            releaseTimestamp: '2022-02-19T04:37:38.591Z',
            version: '2.10.2',
          },
          {
            isStable: true,
            releaseTimestamp: '2022-03-03T02:51:02.356Z',
            version: '2.10.3',
          },
          {
            isStable: false,
            releaseTimestamp: '2022-02-16T18:34:51.633Z',
            version: '2.11.0-0.1.pre',
          },
          {
            isStable: false,
            releaseTimestamp: '2022-03-17T23:45:13.673Z',
            version: '2.12.0-4.1.pre',
          },
        ],
        sourceUrl: 'https://github.com/flutter/flutter',
      });
      expect(res?.releases).toHaveLength(31);
    });
  });
});
