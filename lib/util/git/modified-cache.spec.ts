import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedModifiedResult,
  setCachedModifiedResult,
} from './modified-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/modified-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedModifiedResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns null if target key not found', () => {
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns null if target SHA has changed', () => {
      repoCache.branches = [{ branchName: 'foo', sha: 'aaa' } as BranchCache];
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns true', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: '111', isModified: true } as BranchCache,
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeTrue();
    });

    it('returns false', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: '111', isModified: false } as BranchCache,
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeFalse();
    });
  });

  describe('setCachedModifiedResult', () => {
    it('sets value for unpopulated cache', () => {
      setCachedModifiedResult('foo', '111', false);
      expect(repoCache).toEqual({
        branches: [{ branchName: 'foo', sha: '111', isModified: false }],
      });
    });

    it('replaces value when SHA has changed', () => {
      setCachedModifiedResult('foo', '111', false);
      setCachedModifiedResult('foo', '121', false);
      setCachedModifiedResult('foo', '131', false);
      expect(repoCache).toEqual({
        branches: [{ branchName: 'foo', sha: '131', isModified: false }],
      });
    });

    it('replaces value when both value and SHA have changed', () => {
      setCachedModifiedResult('foo', '111', false);
      setCachedModifiedResult('foo', 'aaa', true);
      expect(repoCache).toEqual({
        branches: [{ branchName: 'foo', sha: 'aaa', isModified: true }],
      });
    });

    it('handles multiple branches', () => {
      setCachedModifiedResult('foo-1', '111', false);
      setCachedModifiedResult('foo-2', 'aaa', true);
      setCachedModifiedResult('foo-3', '222', false);
      expect(repoCache).toEqual({
        branches: [
          { branchName: 'foo-1', sha: '111', isModified: false },
          { branchName: 'foo-2', sha: 'aaa', isModified: true },
          { branchName: 'foo-3', sha: '222', isModified: false },
        ],
      });
    });
  });
});
