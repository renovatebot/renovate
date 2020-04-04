import fs from 'fs';
import _got from '../../util/got';
import { getReleases } from '.';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

const got: jest.Mock<any> = _got as any;
jest.mock('../../util/got');

let res1 = fs.readFileSync(
  'lib/datasource/cdnjs/__fixtures__/d3-force.json',
  'utf8'
);
res1 = JSON.parse(res1);

let res2 = fs.readFileSync(
  'lib/datasource/cdnjs/__fixtures__/bulma.json',
  'utf8'
);
res2 = JSON.parse(res2);

// let res3 = fs.readFileSync(
//   'lib/datasource/cdnjs/__fixtures__/KaTeX.json',
//   'utf8'
// );
// res3 = JSON.parse(res3);

describe('datasource/cdnjs', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      return global.renovateCache.rmAll();
    });
    it('throws for empty result', async () => {
      got.mockResolvedValueOnce(null);
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('throws for missing fields', async () => {
      got.mockResolvedValueOnce({});
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('returns null for 404', async () => {
      got.mockRejectedValueOnce({ statusCode: 404 });
      expect(await getReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('throws for 401', async () => {
      got.mockRejectedValueOnce({ statusCode: 401 });
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('throws for 429', async () => {
      got.mockRejectedValueOnce({ statusCode: 429 });
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('throws for 5xx', async () => {
      got.mockRejectedValueOnce({ statusCode: 502 });
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrowError(
        DATASOURCE_FAILURE
      );
    });
    it('processes real data', async () => {
      got.mockResolvedValueOnce({ body: res1 });
      const res = await getReleases({ lookupName: 'd3-force/d3-force.js' });
      expect(res).toMatchSnapshot();
    });
    it('filters releases by asset presence', async () => {
      got.mockResolvedValueOnce({ body: res2 });
      const res = await getReleases({
        lookupName: 'bulma/only/0.7.5/style.css',
      });
      expect(res).toMatchSnapshot();
    });
  });
});
