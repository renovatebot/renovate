import * as _cache from '../../../util/cache/repository/index.ts';
import type { RepoCacheData } from '../../../util/cache/repository/types.ts';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache.ts';

vi.mock('../../../util/cache/repository/index.ts');

const cache = vi.mocked(_cache);

describe('workers/repository/reconfigure/reconfigure-cache', () => {
  describe('setReconfigureBranchCache()', () => {
    it('sets new cache', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setReconfigureBranchCache('reconfigure-sha', false);
      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: false,
        },
      });
    });

    it('sets new cache with a successful extraction', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);

      setReconfigureBranchCache('reconfigure-sha', true, true);

      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: true,
          extractionSucceeded: true,
        },
      });
    });

    it('omits a failed extraction', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);

      setReconfigureBranchCache('reconfigure-sha', true, false);

      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: true,
        },
      });
    });

    it('updates old cache', () => {
      const dummyCache = {
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setReconfigureBranchCache('reconfigure-sha-1', false);
      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha-1',
          isConfigValid: false,
        },
      });
    });

    it('updates old cache with a successful extraction', () => {
      const dummyCache = {
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: false,
          extractionSucceeded: true,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setReconfigureBranchCache('reconfigure-sha-1', false);
      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha-1',
          isConfigValid: false,
        },
      });
    });
  });

  describe('deleteReconfigureBranchCache()', () => {
    it('deletes cache', () => {
      const dummyCache = {
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      deleteReconfigureBranchCache();
      expect(dummyCache.reconfigureBranchCache).toBeUndefined();
    });
  });
});
