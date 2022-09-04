import { mocked, partial } from '../../../test/util';
import { logger } from '../../logger';
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
        getCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA')
      ).toBeNull();
    });

    it('returns null if branch not found', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'not_foo',
        isModified: false,
      });
      repoCache = { branches: [branchCache] };
      expect(
        getCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA')
      ).toBeNull();
    });

    it('returns null if isBehindBaseBranch is undefined', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'foo',
        sha: 'SHA',
        baseBranchName: 'base_foo',
        isModified: false,
      });
      repoCache = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA')
      ).toBeNull();
    });

    it('returns value', () => {
      const branchCache = partial<BranchCache>({
        branchName: 'foo',
        sha: 'SHA',
        baseBranchSha: 'base_SHA',
        baseBranchName: 'base_foo',
        isBehindBaseBranch: false,
      });
      repoCache = { branches: [branchCache] };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(
        getCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA')
      ).toBeFalse();
    });
  });

  describe('setCachedBehindBaseResult', () => {
    it('populates cache', () => {
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA', false);
      expect(repoCache).toMatchObject({
        branches: [
          {
            branchName: 'foo',
            isBehindBaseBranch: false,
            baseBranchName: 'base_foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
          },
        ],
      });
    });

    it('handles multiple branches', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            isBehindBaseBranch: true,
            baseBranchName: 'base_foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
          }),
          partial<BranchCache>({
            branchName: 'bar',
            isBehindBaseBranch: false,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA', false);
      expect(repoCache).toMatchObject({
        branches: [
          {
            branchName: 'foo',
            isBehindBaseBranch: false,
            baseBranchName: 'base_foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
          },
          {
            branchName: 'bar',
            isBehindBaseBranch: false,
          },
        ],
      });
    });

    it('warns when base branch name mismatches', () => {
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA', false);
      setCachedBehindBaseResult('foo', 'SHA', 'not_base_foo', 'base_SHA', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'base_foo',
            branchName: 'foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
            isBehindBaseBranch: true,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache. Base branch name mismatch'
      );
    });

    it('warns when base branch sha is mismatches', () => {
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA', false);
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'not_base_SHA', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'base_foo',
            branchName: 'foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
            isBehindBaseBranch: true,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache. Base branch sha mismatch'
      );
    });

    it('warns when branch sha is mismatches', () => {
      setCachedBehindBaseResult('foo', 'SHA', 'base_foo', 'base_SHA', false);
      setCachedBehindBaseResult('foo', 'not_SHA', 'base_foo', 'base_SHA', true);
      expect(repoCache).toEqual({
        branches: [
          {
            baseBranchName: 'base_foo',
            branchName: 'foo',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
            isBehindBaseBranch: true,
          },
        ],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid Cache. Branch sha mismatch'
      );
    });
  });
});
