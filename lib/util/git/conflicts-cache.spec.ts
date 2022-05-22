import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { RepoCacheData } from '../cache/repository/types';
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
      repoCache.gitConflicts = {
        foo: { targetBranchSha: 'aaa', sourceBranches: {} },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if source key not found', () => {
      repoCache.gitConflicts = {
        foo: { targetBranchSha: '111', sourceBranches: {} },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns null if source key has changed', () => {
      repoCache.gitConflicts = {
        foo: {
          targetBranchSha: '111',
          sourceBranches: {
            bar: { sourceBranchSha: 'bbb', isConflicted: true },
          },
        },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeNull();
    });

    it('returns true', () => {
      repoCache.gitConflicts = {
        foo: {
          targetBranchSha: '111',
          sourceBranches: {
            bar: { sourceBranchSha: '222', isConflicted: true },
          },
        },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeTrue();
    });

    it('returns false', () => {
      repoCache.gitConflicts = {
        foo: {
          targetBranchSha: '111',
          sourceBranches: {
            bar: { sourceBranchSha: '222', isConflicted: false },
          },
        },
      };
      expect(getCachedConflictResult('foo', '111', 'bar', '222')).toBeFalse();
    });
  });

  describe('setCachedConflictResult', () => {
    it('sets value for unpopulated cache', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', true);
      expect(repoCache).toEqual({
        gitConflicts: {
          foo: {
            targetBranchSha: '111',
            sourceBranches: {
              bar: { sourceBranchSha: '222', isConflicted: true },
            },
          },
        },
      });
    });

    it('replaces value when source SHA has changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', false);
      setCachedConflictResult('foo', '111', 'bar', '333', false);
      setCachedConflictResult('foo', '111', 'bar', '444', true);
      expect(repoCache).toEqual({
        gitConflicts: {
          foo: {
            targetBranchSha: '111',
            sourceBranches: {
              bar: { sourceBranchSha: '444', isConflicted: true },
            },
          },
        },
      });
    });

    it('replaces value when target SHA has changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', false);
      setCachedConflictResult('foo', 'aaa', 'bar', '222', true);
      expect(repoCache).toEqual({
        gitConflicts: {
          foo: {
            targetBranchSha: 'aaa',
            sourceBranches: {
              bar: { sourceBranchSha: '222', isConflicted: true },
            },
          },
        },
      });
    });

    it('replaces value when both target and source SHA have changed', () => {
      setCachedConflictResult('foo', '111', 'bar', '222', true);
      setCachedConflictResult('foo', 'aaa', 'bar', 'bbb', false);
      expect(repoCache).toEqual({
        gitConflicts: {
          foo: {
            targetBranchSha: 'aaa',
            sourceBranches: {
              bar: { sourceBranchSha: 'bbb', isConflicted: false },
            },
          },
        },
      });
    });
  });
});
