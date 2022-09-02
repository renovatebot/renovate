import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedBehindBaseResult,
  setCachedBehindBaseResult,
} from './behind-base-branch-cache';

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
      expect(getCachedBehindBaseResult('foo')).toBeNull();
    });

    it('returns null if branch not found', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'not_foo',
        isModified: false,
      });
      repoCache = { branches: [branchCache] };
      expect(getCachedBehindBaseResult('foo')).toBeNull();
    });

    it('returns null if isBehindBaseBranch is undefined', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'foo',
        isModified: false,
      });
      repoCache = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo')).toBeNull();
    });

    it('returns value', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'foo',
        isBehindBaseBranch: false,
      });
      repoCache = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo')).toBeFalse();
    });
  });

  describe('setCachedBehindBaseResult', () => {
    it('populates cache', () => {
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toMatchObject({
        branches: [
          {
            branchName: 'foo',
            isBehindBaseBranch: false,
          },
        ],
      });
    });

    it('returns null if isBehindBaseBranch is undefined', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            isBehindBaseBranch: true,
          }),
          partial<BranchCache>({
            branchName: 'bar',
            isBehindBaseBranch: false,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toMatchObject({
        branches: [
          {
            branchName: 'foo',
            isBehindBaseBranch: false,
          },
          {
            branchName: 'bar',
            isBehindBaseBranch: false,
          },
        ],
      });
    });
  });
});
