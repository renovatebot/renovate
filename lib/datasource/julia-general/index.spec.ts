import fs from 'fs';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';
import _got from '../../util/got';
import { getReleases } from '.';

const got: jest.Mock<any> = _got as any;
jest.mock('../../util/got');

const res1 = fs.readFileSync(
  'lib/datasource/julia-general/__fixtures__/GaussianProcesses.toml',
  'utf8'
);

describe('datasource/julia-general', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it('returns null for 404', async () => {
      got.mockRejectedValueOnce({ statusCode: 404 });
      expect(await getReleases({ lookupName: 'foo/bar' })).toBeNull();
    });
    it('returns null for empty 200 OK', async () => {
      got.mockResolvedValueOnce({ body: {} });
      expect(
        await getReleases({ lookupName: 'doesnotexist/doesnotexist' })
      ).toBeNull();
    });
    it('throws for 429', async () => {
      got.mockRejectedValueOnce({ statusCode: 429 });
      await expect(getReleases({ lookupName: 'foo/bar' })).rejects.toThrow(
        DATASOURCE_FAILURE
      );
    });
    it('processes real data', async () => {
      got.mockResolvedValueOnce({ body: res1 });
      const res = await getReleases({ lookupName: 'GaussianProcesses' });
      expect(res).toMatchSnapshot();
    });
  });
});
