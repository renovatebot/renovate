import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { getCachedBehindBaseResult } from './behind-base-branch-cache';
import * as _git from '.';

jest.mock('../cache/repository');
jest.mock('.');
const repositoryCache = mocked(_repositoryCache);
const git = mocked(_git);

describe('util/git/behind-base-branch-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBehindBaseResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBehindBaseResult('foo', 'base_branch')).toBeNull();
    });

    it('returns null if branch not found', () => {
      expect(getCachedBehindBaseResult('foo', 'base_branch')).toBeNull();
    });

    it('returns null if cache is partially defined', () => {
      const branchName = 'branchName';
      const branchCache = partial<BranchCache>({
        branchName,
        isModified: false,
      });
      const repoCache: RepoCacheData = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult(branchName, 'base_branch')).toBeNull();
    });

    it('returns true if target SHA has changed', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: 'aaa', baseBranchSha: '222' } as BranchCache,
      ];
      git.getBranchCommit.mockReturnValue('111');
      expect(getCachedBehindBaseResult('foo', 'base_branch')).toBeTrue();
    });

    it('returns false if target SHA has not changed', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: 'aaa', baseBranchSha: '222' } as BranchCache,
      ];
      git.getBranchCommit.mockReturnValue('222');
      expect(getCachedBehindBaseResult('foo', 'base_branch')).toBeFalse();
    });
  });
});
