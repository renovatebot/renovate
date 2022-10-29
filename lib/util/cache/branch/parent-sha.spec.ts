import { mocked } from '../../../../test/util';
import * as _repositoryCache from '../repository';
import type { BranchCache, RepoCacheData } from '../repository/types';
import {
  deleteCachedBranchParentShaResult,
  getCachedBranchParentShaResult,
} from './parent-sha';

jest.mock('../repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/cache/branch/parent-sha', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBranchParentShaResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBranchParentShaResult('foo', '111')).toBeNull();
    });

    it('returns null if target key not found', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'not_foo',
            sha: '111',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo', '111')).toBeNull();
    });

    it('returns null if target key is null', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'not_foo',
            sha: null,
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo', '111')).toBeNull();
    });

    it('returns null if target SHA has changed', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo',
            sha: '222',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo', '111')).toBeNull();
    });

    it('returns cached value', () => {
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo',
            sha: '111',
            parentSha: '000',
          } as BranchCache,
        ],
      });
      expect(getCachedBranchParentShaResult('foo', '111')).toBe('000');
    });
  });

  describe('deleteCachedBranchParentShaResult', () => {
    it('returns null if cache is not populated', () => {
      repoCache.branches = [
        {
          branchName: 'foo',
          sha: '111',
          parentSha: 'sha',
        } as BranchCache,
      ];
      deleteCachedBranchParentShaResult('foo');
      expect(repoCache.branches[0].parentSha).toBeUndefined();
    });
  });
});
