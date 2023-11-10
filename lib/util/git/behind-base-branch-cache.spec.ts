import { logger, mocked, partial } from '../../../test/util';
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
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if branch not found', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'not_branch',
            baseBranchSha: 'base_branch_sha',
            baseBranch: 'base_branch',
            sha: 'branch_sha',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if base branch SHA is different', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: 'not_base_branch_sha',
            baseBranch: 'base_branch',
            sha: 'branch_sha',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if branch sha is different', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: 'base_branch_sha',
            baseBranch: 'base_branch',
            sha: 'not_branch_sha',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if cached value is undefined', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: 'base_branch_sha',
            baseBranch: 'base_branch',
            sha: 'not_branch_sha',
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if base branch SHA is null', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: null,
            baseBranch: 'base_branch',
            sha: 'branch_sha',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns null if branch SHA is null', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: 'base_branch_sha',
            baseBranch: 'base_branch',
            sha: null,
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeNull();
    });

    it('returns cached value', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch',
            baseBranchSha: 'base_branch_sha',
            baseBranch: 'base_branch',
            sha: 'branch_sha',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult(
          'branch',
          'branch_sha',
          'base_branch',
          'base_branch_sha',
        ),
      ).toBeTrue();
    });
  });

  describe('setCachedBehindBasedResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedBehindBaseResult(): Branch cache not present',
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedBehindBaseResult(): Branch cache not present',
      );
    });

    it('updates cached value', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            sha: '121',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo',
            sha: '121',
            isBehindBase: false,
          },
        ],
      });
    });

    it('handles multiple branches', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo-1',
            sha: '111',
            isBehindBase: true,
          }),
          partial<BranchCache>({
            branchName: 'foo-2',
            sha: 'aaa',
            isBehindBase: false,
          }),
          partial<BranchCache>({
            branchName: 'foo-3',
            sha: '222',
            isBehindBase: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedBehindBaseResult('foo-1', false);
      setCachedBehindBaseResult('foo-2', true);
      setCachedBehindBaseResult('foo-3', false);
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo-1',
            sha: '111',
            isBehindBase: false,
          },
          {
            branchName: 'foo-2',
            sha: 'aaa',
            isBehindBase: true,
          },
          {
            branchName: 'foo-3',
            sha: '222',
            isBehindBase: false,
          },
        ],
      });
    });
  });
});
