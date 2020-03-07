import fs from 'fs';

import _got from '../../util/got';
import { getPkgReleases } from './index';

const got: any = _got;

const res1 = fs.readFileSync(
  'lib/datasource/galaxy/__fixtures__/timezone',
  'utf8'
);
const empty = fs.readFileSync(
  'lib/datasource/galaxy/__fixtures__/empty',
  'utf8'
);

jest.mock('../../util/got');

describe('datasource/galaxy', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({
        body: undefined,
      });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: 'yatesr.timezone' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('return null if searching random username and project name', async () => {
      got.mockReturnValueOnce({
        body: empty,
      });
      const res = await getPkgReleases({ lookupName: 'foo.bar' });
      expect(res).toBeNull();
    });
  });
});
