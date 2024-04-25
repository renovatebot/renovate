import { logger, mocked } from '../../../../../test/util';
import * as _cache from '../../../../util/cache/repository';
import type {
  BranchCache,
  RepoCacheData,
} from '../../../../util/cache/repository/types';
import { getPrCache, setPrCache } from './pr-cache';

jest.mock('../../../../util/cache/repository');
const cache = mocked(_cache);

describe('workers/repository/update/pr/pr-cache', () => {
  const branchCache: BranchCache = {
    automerge: false,
    baseBranch: 'base_branch',
    baseBranchSha: 'base_sha',
    branchName: 'branch_name',
    prNo: null,
    sha: 'sha',
    upgrades: [],
    prCache: null,
  };
  const dummyCache: RepoCacheData = {
    branches: [branchCache],
  };

  describe('getPrCache()', () => {
    it('return null if cache is empty', () => {
      cache.getCache.mockReturnValue({});
      expect(getPrCache('branch_name')).toBeNull();
    });

    it('return null if prCache is null/undefined', () => {
      cache.getCache.mockReturnValue(dummyCache);
      expect(getPrCache('branch_name')).toBeNull();
    });

    it('returns prCache', () => {
      branchCache.prCache = {
        bodyFingerprint: 'fp',
        lastEdited: new Date('11/11/2011').toISOString(),
      };
      cache.getCache.mockReturnValue(dummyCache);
      expect(getPrCache('branch_name')).toStrictEqual({
        bodyFingerprint: 'fp',
        lastEdited: new Date('11/11/2011').toISOString(),
      });
    });
  });

  describe('setPrCache()', () => {
    it('logs if branch not found', () => {
      cache.getCache.mockReturnValue(dummyCache);
      setPrCache('branch_1', 'fingerprint_hash', false);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setPrCache(): Branch cache not present',
      );
    });

    it('updates cache', () => {
      cache.getCache.mockReturnValue(dummyCache);
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));
      setPrCache('branch_name', 'fingerprint_hash', true);
      expect(dummyCache).toStrictEqual({
        branches: [
          {
            ...branchCache,
            prCache: {
              bodyFingerprint: 'fingerprint_hash',
              lastEdited: new Date('2020-01-01').toISOString(),
            },
          },
        ],
      });
    });

    it('does not update details if pr not modified', () => {
      const dummyCache2 = {
        branches: [
          {
            ...branchCache,
            prCache: {
              bodyFingerprint: 'fingerprint_hash',
              lastEdited: new Date('2020-01-01').toISOString(),
            },
          },
        ],
      };
      cache.getCache.mockReturnValue(dummyCache);
      jest.useFakeTimers().setSystemTime(new Date('2020-01-02'));
      setPrCache('branch_name', 'fingerprint_hash', false);
      expect(dummyCache2).toStrictEqual({
        branches: [
          {
            ...branchCache,
            prCache: {
              bodyFingerprint: 'fingerprint_hash',
              lastEdited: new Date('2020-01-01').toISOString(),
            },
          },
        ],
      });
    });
  });
});
