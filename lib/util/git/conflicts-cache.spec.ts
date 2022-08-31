import { mocked, partial } from '../../../test/util';
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

    it('returns null if target key not found', () => {
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
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
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if source key not found', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          baseBranchSha: '121',
          isConflicted: true,
        }),
      ];
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if source key has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({
          baseBranchName: 'foo',
          branchName: 'aaa',
          sha: '221',
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

    it('replaces value when branch SHA has changed', () => {
      setCachedConflictResult('foo', '101', 'bar', '222', false);
      setCachedConflictResult('foo', '111', 'bar', '333', false);
      setCachedConflictResult('foo', '121', 'bar', '444', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '444',
            baseBranchSha: '121',
            isConflicted: true,
          },
        ],
      });
    });

    it('replaces value when target branch SHA has changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', false);
      setCachedConflictResult('foo', 'aaa', 'bar', '222', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: '222',
            baseBranchSha: 'aaa',
            isConflicted: true,
          },
        ],
      });
    });

    it('replaces value when both target and source SHA have changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', true);
      setCachedConflictResult('foo', 'aaa', 'bar', 'bbb', false);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'foo',
            branchName: 'bar',
            sha: 'bbb',
            baseBranchSha: 'aaa',
            isConflicted: false,
          },
        ],
      });
    });
  });
});
