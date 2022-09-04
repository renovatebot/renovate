import { mocked, partial } from '../../../test/util';
import { logger } from '../../logger';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedConflictResult,
  setCachedConflictResult,
} from './conflicts-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/conflicts-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedConflictResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if target branch name mismatch', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'aaa',
          sha: '444',
          baseBranchSha: '121',
          isConflicted: true,
        }),
      ];
      expect(
        getCachedConflictResult('not_foo', '111', 'bar', '222')
      ).toBeNull();
    });

    it('returns null if target SHA has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'aaa',
          sha: '444',
          baseBranchSha: '121',
          isConflicted: true,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'aaa', '444')).toBeNull();
    });

    it('returns null if source branch not found', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          baseBranchSha: '121',
          isConflicted: true,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if source branch sha has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'bar',
          sha: '212',
          baseBranchSha: '111',
          isConflicted: true,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns true', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'bar',
          sha: '222',
          baseBranchSha: '111',
          isConflicted: true,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeTrue();
    });

    it('returns false', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'bar',
          sha: '222',
          baseBranchSha: '111',
          isConflicted: false,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeFalse();
    });

    it('returns null and removes gitConflicts', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'bar',
          sha: '222',
          baseBranchSha: '111',
          isConflicted: false,
        }),
      ];
      repoCache.gitConflicts = {
        targetBranchName: {
          targetBranchSha: 'target_sha',
          sourceBranches: {
            sourceBranchName: {
              sourceBranchSha: 'source_sha',
              isConflicted: false,
            },
          },
        },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeFalse();
      expect(repoCache.gitConflicts).toBeUndefined();
    });
  });

  describe('setCachedConflictResult', () => {
    it('sets value for unpopulated cache', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '222',
            baseBranchSha: '111',
            isConflicted: true,
          },
        ],
      });
    });

    it('warns when branch SHA has changed', () => {
      setCachedConflictResult('foo', '101', 'bar', '222', false);
      setCachedConflictResult('foo', '101', 'bar', '202', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '222',
            baseBranchSha: '101',
            isConflicted: true,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache.Cached branch SHA is different than source branch SHA'
      );
    });

    it('warns when target branch SHA has changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', false);
      setCachedConflictResult('foo', '101', 'bar', '222', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '222',
            baseBranchSha: '111',
            isConflicted: true,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache.Cached target branch SHA is different from fetched current branch state'
      );
    });

    it('replaces value when both target and source SHA have changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', true);
      setCachedConflictResult('foo', '101', 'bar', '202', false);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '222',
            baseBranchSha: '111',
            isConflicted: false,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache.Cached branch SHA is different than source branch SHA'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache.Cached target branch SHA is different from fetched current branch state'
      );
    });
  });
});
