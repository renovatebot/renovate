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
      expect(res).toMatchObject({
        homepage:
          'https://github.com/flutter/plugins/tree/master/packages/shared_preferences/shared_preferences',
        sourceUrl: 'https://github.com/flutter/plugins',
        releases: [
          {
            version: '0.1.1',
            releaseTimestamp: '2017-05-09T18:25:24.268Z',
          },
          { version: '0.2.0' },
          { version: '0.2.0+1' },
          { version: '0.2.3' },
          { version: '0.2.4' },
          { version: '0.2.4+1' },
          { version: '0.2.5' },
          { version: '0.3.0' },
          { version: '0.3.1' },
          { version: '0.3.2' },
          { version: '0.3.3' },
          { version: '0.4.0' },
          { version: '0.4.1' },
          { version: '0.4.2' },
          { version: '0.4.3' },
          { version: '0.5.0' },
          { version: '0.5.1+1' },
          { version: '0.5.1+2' },
          { version: '0.5.2' },
          { version: '0.5.2+1' },
          { version: '0.5.2+2' },
          { version: '0.5.3' },
          { version: '0.5.3+1' },
          { version: '0.5.3+2' },
          { version: '0.5.3+3' },
          { version: '0.5.3+4' },
          { version: '0.5.3+5' },
          { version: '0.5.4' },
          { version: '0.5.4+1' },
          { version: '0.5.4+3' },
          { version: '0.5.4+5' },
          { version: '0.5.4+6' },
          { version: '0.5.4+8' },
          { version: '0.5.4+9' },
          { version: '0.5.5' },
          { version: '0.5.6' },
          { version: '0.5.6+1' },
          { version: '0.5.6+2' },
          { version: '0.5.6+3' },
          { version: '0.5.7' },
          { version: '0.5.7+1' },
          { version: '0.5.7+2' },
          { version: '0.5.7+3' },
          {
            version: '0.5.8',
            releaseTimestamp: '2020-07-08T04:36:43.412Z',
          },
        ],
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
