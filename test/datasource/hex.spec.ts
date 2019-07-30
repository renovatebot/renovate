import { readFileSync } from 'fs';
import _got from '../../lib/util/got';
import { find as _find } from '../../lib/util/host-rules';
import { getPkgReleases } from '../../lib/datasource/hex';

const got: any = _got;
const find: any = _find;

let res1 = readFileSync('test/datasource/hex/_fixtures/certifi.json', 'utf8');
res1 = JSON.parse(res1);

jest.mock('../../lib/util/got');
jest.mock('../../lib/util/host-rules');

describe('datasource/hex', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({ res: {} });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null for 401', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      expect(await getPkgReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null with wrong auth token', async () => {
      find.mockReturnValueOnce({ token: 'this_simple_token' });
      got.mockReturnValueOnce(
        Promise.reject({
          statusCode: 401,
        })
      );
      const res = await getPkgReleases({ lookupName: 'certifi' });
      expect(res).toBeNull();
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
      find.mockReturnValueOnce({});
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
