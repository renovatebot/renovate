import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedModifiedResult,
  setCachedModifiedResult,
} from './modified-cache';
import * as _git from '.';

jest.mock('../cache/repository');
jest.mock('.');
const git = mocked(_git);
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
      git.getBranchCommit.mockReturnValueOnce('SHA');
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({
        branches: [{ branchName: 'foo', sha: 'SHA', isModified: false }],
      });
    });

    it('handles multiple branches', () => {
      git.getBranchCommit.mockReturnValue('SHA');
      setCachedModifiedResult('foo-1', false);
      setCachedModifiedResult('foo-2', true);
      setCachedModifiedResult('foo-3', false);
      expect(repoCache).toEqual({
        branches: [
          { branchName: 'foo-1', sha: 'SHA', isModified: false },
          { branchName: 'foo-2', sha: 'SHA', isModified: true },
          { branchName: 'foo-3', sha: 'SHA', isModified: false },
        ],
      });
    });
  });
});
