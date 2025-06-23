import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { DartDatasource } from '.';

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
      expect(res).toMatchSnapshot();
    });
  });
});
