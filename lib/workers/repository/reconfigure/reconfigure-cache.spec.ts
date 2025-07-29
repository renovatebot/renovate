import * as _cache from '../../../util/cache/repository';
import type { RepoCacheData } from '../../../util/cache/repository/types';
import type { BranchConfig } from '../../types';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache';
import { partial } from '~test/util';

vi.mock('../../../util/cache/repository');

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

    it('updates extractResult old cache', () => {
      const dummyCache = {
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          isConfigValid: false,
          extractResult: {
            branches: [partial<BranchConfig>()],
            branchList: ['some-branch'],
            packageFiles: {},
          },
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
