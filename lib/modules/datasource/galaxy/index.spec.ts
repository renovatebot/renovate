import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { GalaxyDatasource } from '.';

const baseUrl = 'https://galaxy.ansible.com/';

describe('modules/datasource/galaxy/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200);
      expect(
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, undefined);
      expect(
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty list', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, '\n');
      expect(
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'some_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .replyWithError('some unknown error');
      expect(
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'some_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, Fixtures.get('timezone'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        depName: 'yatesr.timezone',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('return null if searching random username and project name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=foo&name=bar')
        .reply(200, Fixtures.get('empty'));
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        depName: 'foo.bar',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .reply(502);
      let e;
      try {
        await getPkgReleases({
          datasource: GalaxyDatasource.id,
          depName: 'some_crate',
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=foo&name=bar')
        .reply(404);
      const res = await getPkgReleases({
        datasource: GalaxyDatasource.id,
        depName: 'foo.bar',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
