import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';

import { id as datasource } from '.';

const res1 = fs.readFileSync(
  'lib/datasource/galaxy/__fixtures__/timezone',
  'utf8'
);
const empty = fs.readFileSync(
  'lib/datasource/galaxy/__fixtures__/empty',
  'utf8'
);

const baseUrl = 'https://galaxy.ansible.com/';

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200);
      expect(
        await getPkgReleases({ datasource, depName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, undefined);
      expect(
        await getPkgReleases({ datasource, depName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty list', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=non_existent_crate&name=undefined')
        .reply(200, '\n');
      expect(
        await getPkgReleases({ datasource, depName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .reply(404);
      expect(
        await getPkgReleases({ datasource, depName: 'some_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=some_crate&name=undefined')
        .replyWithError('some unknown error');
      expect(
        await getPkgReleases({ datasource, depName: 'some_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v1/roles/?owner__username=yatesr&name=timezone')
        .reply(200, res1);
      const res = await getPkgReleases({
        datasource,
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
        .reply(200, empty);
      const res = await getPkgReleases({ datasource, depName: 'foo.bar' });
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
        await getPkgReleases({ datasource, depName: 'some_crate' });
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
      const res = await getPkgReleases({ datasource, depName: 'foo.bar' });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
