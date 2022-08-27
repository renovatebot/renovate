import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedBranchParentShaResult,
  setCachedBranchParentShaResult,
} from './parent-sha-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/parent-sha-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBranchParentShaResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBranchParentShaResult('foo')).toBeNull();
    });

    it('returns null if branch not found', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'not_foo',
            sha: '111',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo')).toBeNull();
    });

    it('returns null if parentSha not stored', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'not_foo',
            sha: '111',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo')).toBeNull();
    });

    it('returns cached value', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo',
            parentSha: '000',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo')).toBe('000');
    });
  });

  describe('setCachedBranchParentShaResult', () => {
    it('populates cache if it is empty', () => {
      setCachedBranchParentShaResult('foo', '111');
      expect(repoCache?.branches?.[0].parentSha).toBe('111');
    });

    it('handles more than one branch', () => {
      repoCache.branches = [
        {
          branchName: 'not_foo',
          sha: '111',
        } as BranchCache,
        {
          branchName: 'foo',
          sha: '112',
        } as BranchCache,
      ];
      setCachedBranchParentShaResult('foo', '111');
      const branch = repoCache.branches?.find(
        (branch) => branch.branchName === 'foo'
      );
      expect(repoCache?.branches?.[0].parentSha).toBeUndefined();
      expect(branch?.parentSha).toBe('111');
    });
  });
});
