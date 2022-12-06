import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DartVersionDatasource } from '.';

const baseUrl = 'https://storage.googleapis.com';
const urlPath =
  '/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2Fstable%2Frelease%2F&alt=json';
const datasource = DartVersionDatasource.id;
const depName = 'dart';
const channels = ['stable', 'beta', 'dev'];

describe('modules/datasource/dart-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(500);
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock.scope(baseUrl).get(urlPath).replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('processes real data', async () => {
      for (const channel of channels) {
        httpMock
          .scope(baseUrl)
          .get(
            `/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2F${channel}%2Frelease%2F&alt=json`
          )
          .reply(200, Fixtures.get(`${channel}.json`));
      }
      const res = await getPkgReleases({
        datasource,
        depName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(103);
    });
  });
});
