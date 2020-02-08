import fs from 'fs';

import _got from '../../lib/util/got';
import { getPkgReleases } from '../../lib/datasource/ansible-galaxy';

const got: any = _got;

const res1 = fs.readFileSync(
  'test/datasource/ansible-galaxy/_fixtures/timezone',
  'utf8'
);
const empty = fs.readFileSync(
  'test/datasource/ansible-galaxy/_fixtures/empty',
  'utf8'
);

jest.mock('../../lib/util/got');

describe('datasource/ansible-galaxy', () => {
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
    it('returns null for empty list', async () => {
      got.mockReturnValueOnce({
        body: '\n',
      });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ lookupName: 'some_crate' })).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases({ lookupName: 'some_crate' })).toBeNull();
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
    it('returns null if lookupName is undefined', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: undefined });
      expect(res).toBeNull();
    });
  });
});
