import fs from 'fs';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import { getPkgReleases } from '.';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

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
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({});
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();

      got.mockReturnValueOnce({ body: {} });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('throws for 404', async () => {
      const err = new Error();
      err.statusCode = 404;
      got.mockImplementationOnce(() => {
        throw err;
      });
      await expect(getPkgReleases({ lookupName: 'foo/bar' })).rejects.toThrow();
    });
    it('throws for 429', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 429,
        })
      );
      await expect(
        getPkgReleases({ lookupName: 'some_crate' })
      ).rejects.toThrowError(DATASOURCE_FAILURE);
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      await expect(
        getPkgReleases({ lookupName: 'some_crate' })
      ).rejects.toThrowError(DATASOURCE_FAILURE);
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: 'certifi' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('process public repo without auth', async () => {
      hostRules.find.mockReturnValueOnce({});
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: 'certifi' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
  });
});
