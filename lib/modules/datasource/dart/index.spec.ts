import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { DartDatasource } from './index.ts';

const body = Fixtures.getJson('shared_preferences.json');

const baseUrl = 'https://pub.dartlang.org/api/packages/';

describe('modules/datasource/dart/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/non_sense').reply(200, '}');
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'non_sense',
        }),
      ).toBeNull();
    });

    it('returns null for empty fields', async () => {
      const withoutVersions = {
        ...body,
        versions: undefined,
      };
      httpMock
        .scope(baseUrl)
        .get('/shared_preferences')
        .reply(200, withoutVersions);
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'shared_preferences',
        }),
      ).toBeNull();

      const withoutLatest = {
        ...body,
        latest: undefined,
      };
      httpMock
        .scope(baseUrl)
        .get('/shared_preferences')
        .reply(200, withoutLatest);
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'shared_preferences',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(404);
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'shared_preferences',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(502);
      await expect(
        getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'shared_preferences',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').replyWithError('');
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          packageName: 'shared_preferences',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(200, body);
      const res = await getPkgReleases({
        datasource: DartDatasource.id,
        packageName: 'shared_preferences',
      });
      expect(res).toEqual({
        homepage:
          'https://github.com/flutter/plugins/tree/master/packages/shared_preferences/shared_preferences',
        registryUrl: 'https://pub.dartlang.org',
        releases: [
          {
            releaseTimestamp: '2017-05-09T18:25:24.268Z',
            version: '0.1.1',
          },
          {
            releaseTimestamp: '2017-05-11T10:45:03.041Z',
            version: '0.2.0',
          },
          {
            releaseTimestamp: '2017-05-17T07:37:42.515Z',
            version: '0.2.0+1',
          },
          {
            releaseTimestamp: '2017-06-03T14:12:51.183Z',
            version: '0.2.3',
          },
          {
            releaseTimestamp: '2017-06-05T19:33:50.975Z',
            version: '0.2.4',
          },
          {
            releaseTimestamp: '2017-06-05T19:59:16.090Z',
            version: '0.2.4+1',
          },
          {
            releaseTimestamp: '2017-08-30T17:09:33.914Z',
            version: '0.2.5',
          },
          {
            releaseTimestamp: '2017-12-20T15:38:21.917Z',
            version: '0.3.0',
          },
          {
            releaseTimestamp: '2018-01-12T15:09:05.976Z',
            version: '0.3.1',
          },
          {
            releaseTimestamp: '2018-02-05T20:57:27.104Z',
            version: '0.3.2',
          },
          {
            releaseTimestamp: '2018-02-28T15:41:47.772Z',
            version: '0.3.3',
          },
          {
            releaseTimestamp: '2018-03-09T16:12:39.663Z',
            version: '0.4.0',
          },
          {
            releaseTimestamp: '2018-04-09T08:43:11.818Z',
            version: '0.4.1',
          },
          {
            releaseTimestamp: '2018-06-01T19:14:21.586Z',
            version: '0.4.2',
          },
          {
            releaseTimestamp: '2018-10-01T19:17:45.554Z',
            version: '0.4.3',
          },
          {
            releaseTimestamp: '2019-01-24T23:22:56.870Z',
            version: '0.5.0',
          },
          {
            releaseTimestamp: '2019-02-08T02:03:10.911Z',
            version: '0.5.1+1',
          },
          {
            releaseTimestamp: '2019-03-15T15:44:55.382Z',
            version: '0.5.1+2',
          },
          {
            releaseTimestamp: '2019-04-09T15:32:00.113Z',
            version: '0.5.2',
          },
          {
            releaseTimestamp: '2019-05-22T16:11:30.917Z',
            version: '0.5.2+1',
          },
          {
            releaseTimestamp: '2019-05-30T00:37:40.912Z',
            version: '0.5.2+2',
          },
          {
            releaseTimestamp: '2019-05-31T22:52:25.471Z',
            version: '0.5.3',
          },
          {
            releaseTimestamp: '2019-06-04T00:34:04.927Z',
            version: '0.5.3+1',
          },
          {
            releaseTimestamp: '2019-07-08T01:27:57.932Z',
            version: '0.5.3+2',
          },
          {
            releaseTimestamp: '2019-07-16T01:25:26.525Z',
            version: '0.5.3+3',
          },
          {
            releaseTimestamp: '2019-07-16T12:32:40.229Z',
            version: '0.5.3+4',
          },
          {
            releaseTimestamp: '2019-10-16T22:49:22.744Z',
            version: '0.5.3+5',
          },
          {
            releaseTimestamp: '2019-10-22T00:00:44.785Z',
            version: '0.5.4',
          },
          {
            releaseTimestamp: '2019-10-25T22:47:57.255Z',
            version: '0.5.4+1',
          },
          {
            releaseTimestamp: '2019-10-28T22:44:38.107Z',
            version: '0.5.4+3',
          },
          {
            releaseTimestamp: '2019-11-13T01:12:51.650Z',
            version: '0.5.4+5',
          },
          {
            releaseTimestamp: '2019-11-25T22:46:39.167Z',
            version: '0.5.4+6',
          },
          {
            releaseTimestamp: '2019-12-03T22:28:49.437Z',
            version: '0.5.4+8',
          },
          {
            releaseTimestamp: '2019-12-10T04:45:58.964Z',
            version: '0.5.4+9',
          },
          {
            releaseTimestamp: '2019-12-10T21:43:54.946Z',
            version: '0.5.5',
          },
          {
            releaseTimestamp: '2019-12-11T00:12:47.456Z',
            version: '0.5.6',
          },
          {
            releaseTimestamp: '2020-01-23T21:53:34.756Z',
            version: '0.5.6+1',
          },
          {
            releaseTimestamp: '2020-02-20T23:57:05.213Z',
            version: '0.5.6+2',
          },
          {
            releaseTimestamp: '2020-03-10T17:55:26.669Z',
            version: '0.5.6+3',
          },
          {
            releaseTimestamp: '2020-04-21T04:36:13.482Z',
            version: '0.5.7',
          },
          {
            releaseTimestamp: '2020-05-06T02:25:58.787Z',
            version: '0.5.7+1',
          },
          {
            releaseTimestamp: '2020-05-12T03:51:13.065Z',
            version: '0.5.7+2',
          },
          {
            releaseTimestamp: '2020-05-21T19:52:19.756Z',
            version: '0.5.7+3',
          },
          {
            releaseTimestamp: '2020-07-08T04:36:43.412Z',
            version: '0.5.8',
          },
        ],
        sourceUrl: 'https://github.com/flutter/plugins',
      });
    });

    it('includes constraints from pubspec environment', async () => {
      httpMock
        .scope(baseUrl)
        .get('/test_pkg')
        .reply(200, {
          versions: [
            {
              version: '1.0.0',
              published: '2023-01-01T00:00:00.000Z',
              pubspec: {
                environment: {
                  sdk: '>=2.19.0 <3.0.0',
                },
              },
            },
            {
              version: '2.0.0',
              published: '2024-01-01T00:00:00.000Z',
              pubspec: {
                environment: {
                  sdk: '^3.0.0',
                  flutter: '>=3.10.0',
                },
              },
            },
            {
              version: '3.0.0',
              published: '2024-06-01T00:00:00.000Z',
            },
          ],
          latest: {
            pubspec: {},
          },
        });
      const res = await getPkgReleases({
        datasource: DartDatasource.id,
        packageName: 'test_pkg',
        constraintsFiltering: 'strict',
        constraints: { dart: '>=2.19.0 <3.0.0' },
      });
      expect(res).toEqual({
        registryUrl: 'https://pub.dartlang.org',
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: '2023-01-01T00:00:00.000Z',
          },
          {
            version: '3.0.0',
            releaseTimestamp: '2024-06-01T00:00:00.000Z',
          },
        ],
      });
    });
  });
});
