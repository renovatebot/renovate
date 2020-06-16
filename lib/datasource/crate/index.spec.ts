import fs from 'fs';
import * as httpMock from '../../../test/httpMock';

import { getReleases } from '.';

const res1 = fs.readFileSync('lib/datasource/crate/__fixtures__/libc', 'utf8');
const res2 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/amethyst',
  'utf8'
);
const res3 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/invalid_crate_data',
  'utf8'
);

const baseUrl =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

describe('datasource/crate', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, {});
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/no/n_/non_existent_crate')
        .reply(200, undefined);
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty list', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, '\n');
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(404);
      expect(await getReleases({ lookupName: 'some_crate' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(502);
      let e;
      try {
        await getReleases({ lookupName: 'some_crate' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').replyWithError('');
      expect(await getReleases({ lookupName: 'some_crate' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: libc', async () => {
      httpMock.scope(baseUrl).get('/li/bc/libc').reply(200, res1);
      const res = await getReleases({ lookupName: 'libc' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: amethyst', async () => {
      httpMock.scope(baseUrl).get('/am/et/amethyst').reply(200, res2);
      const res = await getReleases({ lookupName: 'amethyst' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if crate name is invalid', async () => {
      httpMock.scope(baseUrl).get('/in/va/invalid-crate-name').reply(200, res2);
      const res = await getReleases({ lookupName: 'invalid-crate-name' });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for invalid crate data', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(200, res3);
      const res = await getReleases({ lookupName: 'some_crate' });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
