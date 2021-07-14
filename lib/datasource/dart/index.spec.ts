import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadJsonFixture } from '../../../test/util';
import { DartDatasource } from '.';

const body = loadJsonFixture('shared_preferences.json');

const baseUrl = 'https://pub.dartlang.org/api/packages/';

describe(getName(), () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/non_sense').reply(200, null);
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          depName: 'non_sense',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'shared_preferences',
        })
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
          depName: 'shared_preferences',
        })
      ).toBeNull();

      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(404);
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          depName: 'shared_preferences',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(502);
      let e;
      try {
        await getPkgReleases({
          datasource: DartDatasource.id,
          depName: 'shared_preferences',
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').replyWithError('');
      expect(
        await getPkgReleases({
          datasource: DartDatasource.id,
          depName: 'shared_preferences',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(200, body);
      const res = await getPkgReleases({
        datasource: DartDatasource.id,
        depName: 'shared_preferences',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
