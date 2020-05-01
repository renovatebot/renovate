import { getPkgReleases } from '..';
import { mocked } from '../../../test/util';
import { GotResponse } from '../../platform';
import { api as _api } from '../../platform/github/gh-got-wrapper';
import { clearRepoCache } from '../../util/cache';
import * as rubyVersioning from '../../versioning/ruby';
import * as pod from '.';

const api = mocked(_api);

jest.mock('../../platform/github/gh-got-wrapper');

const config = {
  versioning: rubyVersioning.id,
  datasource: pod.id,
  depName: 'foo',
  registryUrls: [],
};

describe('datasource/cocoapods', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      clearRepoCache();
      return global.renovateCache.rmAll();
    });

    it('returns null for invalid inputs', async () => {
      api.get.mockResolvedValueOnce(null);
      expect(
        await getPkgReleases({
          datasource: pod.id,
          depName: 'foobar',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty result', async () => {
      api.get.mockResolvedValueOnce(null);
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for missing fields', async () => {
      api.get.mockResolvedValueOnce({} as GotResponse);
      expect(await getPkgReleases(config)).toBeNull();

      api.get.mockResolvedValueOnce({ body: '' } as GotResponse);
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
      await expect(
        getPkgReleases({
          ...config,
          registryUrls: ['https://cdn.cocoapods.org'],
        })
      ).rejects.toThrowError('registry-failure');
    });
    it('throws for 5xx', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      await expect(
        getPkgReleases({
          ...config,
          registryUrls: ['https://cdn.cocoapods.org'],
        })
      ).rejects.toThrowError('registry-failure');
    });
    it('returns null for unknown error', async () => {
      api.get.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('processes real data from CDN', async () => {
      api.get.mockResolvedValueOnce({
        body: 'foo/1.2.3',
      } as GotResponse);
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: ['https://github.com/CocoaPods/Specs'],
        })
      ).toEqual({
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });
    it('processes real data from Github', async () => {
      api.get.mockResolvedValueOnce({
        body: [{ name: '1.2.3' }],
      } as GotResponse);
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: ['https://github.com/Artsy/Specs'],
        })
      ).toEqual({
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });
  });
});
