import fs from 'fs';
import _got from '../../util/got';
import { getPkgReleases } from '.';

const got: any = _got;

const body: any = JSON.parse(
  fs.readFileSync(
    'lib/datasource/dart/__fixtures__/shared_preferences.json',
    'utf8'
  )
);

jest.mock('../../util/got');

describe('datasource/dart', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(await getPkgReleases({ lookupName: 'non_sense' })).toBeNull();
    });
    it('returns null for empty fields', async () => {
      const withoutVersions = {
        ...body,
        versions: undefined,
      };
      got.mockReturnValueOnce({ body: withoutVersions });
      expect(
        await getPkgReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();

      const withoutLatest = {
        ...body,
        latest: undefined,
      };
      got.mockReturnValueOnce({ body: withoutLatest });
      expect(
        await getPkgReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await getPkgReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getPkgReleases({ lookupName: 'shared_preferences' });
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
      expect(
        await getPkgReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({ body });
      const res = await getPkgReleases({
        lookupName: 'shared_preferences',
      });
      expect(res).toMatchSnapshot();
    });
  });
});
