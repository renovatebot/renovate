import { mocked } from '../../../../test/util';
import * as _cache from '../../../util/cache/repository';
import type { RepoCacheData } from '../../../util/cache/repository/types';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache';

jest.mock('../../../util/cache/repository');

const cache = mocked(_cache);

describe('workers/repository/reconfigure/reconfigure-cache', () => {
  describe('setReconfigureBranchCache()', () => {
    it('sets new cache', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setReconfigureBranchCache('reconfigure-sha', 'renovate.json', false);
      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
          configFileName: 'renovate.json',
          isConfigValid: false,
        },
      });
    });

    it('updates old cache', () => {
      const dummyCache = {
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha',
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setReconfigureBranchCache('reconfigure-sha-1', 'renovate.json', false);
      expect(dummyCache).toEqual({
        reconfigureBranchCache: {
          reconfigureBranchSha: 'reconfigure-sha-1',
          configFileName: 'renovate.json',
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
          configFileName: 'renovate.json',
          isConfigValid: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      deleteReconfigureBranchCache();
      expect(dummyCache.reconfigureBranchCache).toBeUndefined();
    });
  });
});
