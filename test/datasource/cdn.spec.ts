import fs from 'fs';
import _got from '../../lib/util/got';
import { getPkgReleases } from '../../lib/datasource/cdn';
import { DATASOURCE_FAILURE } from '../../lib/constants/error-messages';

const got: any = _got;

let res1 = fs.readFileSync(
  'test/datasource/cdn/_fixtures/d3-force.json',
  'utf8'
);
res1 = JSON.parse(res1);

let res2 = fs.readFileSync('test/datasource/cdn/_fixtures/bulma.json', 'utf8');
res2 = JSON.parse(res2);

jest.mock('../../lib/util/got');

describe('datasource/cdn', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(await getPkgReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({});
      expect(await getPkgReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('returns null for 401', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      expect(await getPkgReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('throws for 429', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 429,
        })
      );
      await expect(
        getPkgReleases({ lookupName: 'foo/bar' })
      ).rejects.toThrowError(DATASOURCE_FAILURE);
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      await expect(
        getPkgReleases({ lookupName: 'foo/bar' })
      ).rejects.toThrowError(DATASOURCE_FAILURE);
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('returns null with wrong auth token', async () => {
      got.mockReturnValueOnce(
        Promise.reject({
          statusCode: 401,
        })
      );
      const res = await getPkgReleases({ lookupName: 'foo/bar' });
      expect(res).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({ body: res1 });
      const res = await getPkgReleases({ lookupName: 'd3-force/d3-force.js' });
      expect(res).toMatchSnapshot();
    });
    it('filters releases by asset presence', async () => {
      got.mockReturnValueOnce({ body: res2 });
      const res = await getPkgReleases({
        lookupName: 'bulma/only/0.7.5/style.css',
      });
      expect(res).toMatchSnapshot();
    });
  });
});
