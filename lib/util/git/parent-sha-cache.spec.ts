import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedBaseBranchShaResult,
  setCachedBaseBranchShaResult,
} from './parent-sha-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/parent-sha-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBaseBranchShaResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBaseBranchShaResult('foo')).toBeNull();
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
      expect(getCachedBaseBranchShaResult('foo')).toBeNull();
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
      expect(getCachedBaseBranchShaResult('foo')).toBeNull();
    });

    it('returns cached value', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo',
            baseBranchSha: '000',
          } as BranchCache,
        ],
      });
      expect(getCachedBaseBranchShaResult('foo')).toBe('000');
    });
  });

  describe('setCachedBaseBranchShaResult', () => {
    it('populates cache if it is empty', () => {
      setCachedBaseBranchShaResult('foo', '111');
      expect(repoCache?.branches?.[0].baseBranchSha).toBe('111');
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
      setCachedBaseBranchShaResult('foo', '111');
      const branch = repoCache.branches?.find(
        (branch) => branch.branchName === 'foo'
      );
      expect(repoCache?.branches?.[0].baseBranchSha).toBeUndefined();
      expect(branch?.baseBranchSha).toBe('111');
    });
  });
});
