import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { getCachedBehindBaseResult } from './behind-base-branch-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/behind-base-branch-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBehindBaseResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBehindBaseResult('foo', '111')).toBeNull();
    });

    it('returns null if branch not found', () => {
      expect(getCachedBehindBaseResult('foo', '111')).toBeNull();
    });

    it('returns null if cache is partially defined', () => {
      const branchName = 'branchName';
      const branchCache = partial<BranchCache>({
        branchName,
        isModified: false,
      });
      const repoCache: RepoCacheData = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult(branchName, '111')).toBeNull();
    });

    it('returns true if target SHA has changed', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: 'aaa', parentSha: '222' } as BranchCache,
      ];
      expect(getCachedBehindBaseResult('foo', '111')).toBeTrue();
    });

    it('returns false if target SHA has not changed', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: 'aaa', parentSha: '111' } as BranchCache,
      ];
      expect(getCachedBehindBaseResult('foo', '111')).toBeFalse();
    });
  });
});
