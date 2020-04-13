import _got from '../../util/got';
import * as pod from '.';
import * as rubyVersioning from '../../versioning/ruby';
import { getPkgReleases } from '..';
import { GotResponse } from '../../platform';

jest.mock('../../util/got');
const got: any = _got;

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
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });

    it('returns null for invalid inputs', async () => {
      got.mockResolvedValueOnce(null);
      expect(
        await getPkgReleases({
          datasource: pod.id,
          depName: 'foobar',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty result', async () => {
      got.mockResolvedValueOnce(null);
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockResolvedValueOnce({} as GotResponse);
      expect(await getPkgReleases(config)).toBeNull();

      got.mockResolvedValueOnce({ body: '' } as GotResponse);
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementation(() =>
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
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('throws for 429', async () => {
      got.mockImplementationOnce(() =>
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
      got.mockImplementationOnce(() =>
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
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases(config)).toBeNull();
    });
    it('processes real data from CDN', async () => {
      got.mockResolvedValueOnce({
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
      got.mockResolvedValueOnce({
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
