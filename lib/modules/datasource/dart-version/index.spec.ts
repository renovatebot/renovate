import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DartVersionDatasource } from '.';

const baseUrl = 'https://storage.googleapis.com';
const urlPath =
  '/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2Fstable%2Frelease%2F&alt=json';
const datasource = DartVersionDatasource.id;
const packageName = 'dart';
const channels = ['stable', 'beta', 'dev'];

describe('modules/datasource/dart-version/index', () => {
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
      const scope = httpMock.scope(baseUrl);
      for (const channel of channels) {
        scope
          .get(
            `/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2F${channel}%2Frelease%2F&alt=json`,
          )
          .reply(200, { prefixes: [] });
      }
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      for (const channel of channels) {
        httpMock
          .scope(baseUrl)
          .get(
            `/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2F${channel}%2Frelease%2F&alt=json`,
          )
          .reply(200, Fixtures.get(`${channel}.json`));
      }

      const res = await getPkgReleases({
        datasource,
        packageName,
      });

      expect(res).toBeDefined();
      expect(res?.sourceUrl).toBe('https://github.com/dart-lang/sdk');
      expect(res?.releases).toHaveLength(21);
      expect(res?.releases).toIncludeAllPartialMembers([
        { version: '2.18.0', isStable: true },
        { version: '2.17.7', isStable: true },
        { version: '2.19.0-374.2.beta', isStable: false },
        { version: '2.18.0-44.1.beta', isStable: false },
        { version: '2.19.0-81.0.dev', isStable: false },
        { version: '2.18.0-99.0.dev', isStable: false },
      ]);
    });
  });
});
