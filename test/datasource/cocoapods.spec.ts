import { api as _api } from '../../lib/platform/github/gh-got-wrapper';

import { getPkgReleases } from '../../lib/datasource/cocoapods';

const api: any = _api;

jest.mock('../../lib/platform/github/gh-got-wrapper');

const config = {
  lookupName: 'foo',
  registryUrls: ['https://github.com/CocoaPods/Specs'],
};

describe('datasource/cocoapods', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => global.renovateCache.rmAll());
    it('returns null for invalid inputs', async () => {
      api.get.mockReturnValue(null);
      expect(await getPkgReleases({})).toBeNull();
      expect(
        await getPkgReleases({
          lookupName: null,
        })
      ).toBeNull();
      expect(
        await getPkgReleases({
          lookupName: 'foobar',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty result', async () => {
      api.get.mockReturnValueOnce(null);
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for missing fields', async () => {
      api.get.mockReturnValueOnce({});
      expect(await getPkgReleases(config)).toBeNull();

      api.get.mockReturnValueOnce({ body: '' });
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for 404', async () => {
      api.get.mockImplementation(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [
            ...config.registryUrls,
            'invalid',
            'https://github.com/foo/bar',
          ],
        })
      ).toBeNull();
    });
    it('returns null for 401', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('throws for 429', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 429,
        })
      );
      await expect(getPkgReleases(config)).rejects.toThrowError(
        'registry-failure'
      );
    });
    it('throws for 5xx', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      await expect(getPkgReleases(config)).rejects.toThrowError(
        'registry-failure'
      );
    });
    it('returns null for unknown error', async () => {
      api.get.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('processes real data from CDN', async () => {
      api.get.mockReturnValueOnce({
        body: 'foo/1.2.3',
      });
      expect(await getPkgReleases(config)).toEqual({
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });
    it('processes real data from Github', async () => {
      api.get.mockReturnValueOnce(null);
      api.get.mockReturnValueOnce({
        body: [{ name: '1.2.3' }],
      });
      expect(await getPkgReleases(config)).toEqual({
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });
  });
});
