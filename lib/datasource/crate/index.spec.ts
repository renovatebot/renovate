import fs from 'fs';

import _got from '../../util/got';
import { getReleases } from '.';

const got: any = _got;

const res1 = fs.readFileSync('lib/datasource/crate/__fixtures__/libc', 'utf8');
const res2 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/amethyst',
  'utf8'
);
const res3 = fs.readFileSync(
  'lib/datasource/crate/__fixtures__/invalid_crate_data',
  'utf8'
);

jest.mock('../../util/got');

describe('datasource/crate', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({
        body: undefined,
      });
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for empty list', async () => {
      got.mockReturnValueOnce({
        body: '\n',
      });
      expect(
        await getReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getReleases({ lookupName: 'some_crate' })).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getReleases({ lookupName: 'some_crate' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getReleases({ lookupName: 'some_crate' })).toBeNull();
    });
    it('processes real data: libc', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getReleases({ lookupName: 'libc' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('processes real data: amethyst', async () => {
      got.mockReturnValueOnce({
        body: res2,
      });
      const res = await getReleases({ lookupName: 'amethyst' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('returns null if crate name is invalid', async () => {
      got.mockReturnValueOnce({
        body: res2,
      });
      const res = await getReleases({ lookupName: 'invalid-crate-name' });
      expect(res).toBeNull();
    });
    it('returns null for invalid crate data', async () => {
      got.mockReturnValueOnce({
        body: res3,
      });
      const res = await getReleases({ lookupName: 'some_crate' });
      expect(res).toBeNull();
    });
  });
});
