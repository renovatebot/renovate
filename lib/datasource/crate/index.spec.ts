import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';

import { id as datasource, getIndexSuffix } from '.';

const res1 = fs.readFileSync('lib/datasource/crate/__fixtures__/libc', 'utf8');
const res2 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/amethyst',
  'utf8'
);

const baseUrl =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

describe('datasource/crate', () => {
  describe('getIndexSuffix', () => {
    it('returns correct suffixes', () => {
      expect(getIndexSuffix('a')).toBe('1/a');
      expect(getIndexSuffix('1')).toBe('1/1');
      expect(getIndexSuffix('1234567')).toBe('12/34/1234567');
      expect(getIndexSuffix('ab')).toBe('2/ab');
      expect(getIndexSuffix('abc')).toBe('3/a/abc');
      expect(getIndexSuffix('abcd')).toBe('ab/cd/abcd');
      expect(getIndexSuffix('abcde')).toBe('ab/cd/abcde');
    });
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/no/n_/non_existent_crate')
        .reply(200, undefined);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty list', async () => {
      httpMock.scope(baseUrl).get('/no/n_/non_existent_crate').reply(200, '\n');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_crate',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(404);
      expect(
        await getPkgReleases({ datasource, depName: 'some_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').reply(502);
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
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/so/me/some_crate').replyWithError('');
      expect(
        await getPkgReleases({ datasource, depName: 'some_crate' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: libc', async () => {
      httpMock.scope(baseUrl).get('/li/bc/libc').reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'libc',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data: amethyst', async () => {
      httpMock.scope(baseUrl).get('/am/et/amethyst').reply(200, res2);
      const res = await getPkgReleases({
        datasource,
        depName: 'amethyst',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
