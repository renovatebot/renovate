import fs from 'fs';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import { getReleases } from '.';

const got: any = _got;
const hostRules: any = _hostRules;

let res1 = fs.readFileSync(
  'lib/datasource/hex/__fixtures__/certifi.json',
  'utf8'
);
res1 = JSON.parse(res1);

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

describe('datasource/hex', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({});
      expect(
        await getReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();

      got.mockReturnValueOnce({ body: {} });
      expect(
        await getReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null for 401', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      expect(await getReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('throws for 429', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 429,
        })
      );
      await expect(getReleases({ lookupName: 'some_crate' })).rejects.toThrow(
        DATASOURCE_FAILURE
      );
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      await expect(getReleases({ lookupName: 'some_crate' })).rejects.toThrow(
        DATASOURCE_FAILURE
      );
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null with wrong auth token', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'this_simple_token' });
      got.mockReturnValueOnce(
        Promise.reject({
          statusCode: 401,
        })
      );
      const res = await getReleases({ lookupName: 'certifi' });
      expect(res).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getReleases({ lookupName: 'certifi' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('process public repo without auth', async () => {
      hostRules.find.mockReturnValueOnce({});
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getReleases({ lookupName: 'certifi' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
  });
});
