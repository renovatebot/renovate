import { logger, mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedBehindBaseResult,
  setCachedBehindBaseResult,
} from './behind-base-branch-cache';
import * as _git from '.';

jest.mock('../cache/repository');
jest.mock('.');
const git = mocked(_git);
const repositoryCache = mocked(_repositoryCache);

describe('util/git/behind-base-branch-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedBehindBaseResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedBehindBaseResult('foo', 'base_foo')).toBeNull();
    });

    it('returns null if branch not found', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            isModified: false,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('not_foo', 'base_foo')).toBeNull();
    });

    it('returns null if base branch SHA is different', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            baseBranchSha: 'base_sha',
            baseBranch: 'base_foo',
            isModified: false,
            sha: 'sha',
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('not_base_sha');
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo', 'base_foo')).toBeNull();
    });

    it('returns null if branch sha is different', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            baseBranchSha: 'base_sha',
            baseBranch: 'base_foo',
            isModified: false,
            sha: 'sha',
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('not_sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo', 'base_foo')).toBeNull();
    });

    it('returns null if cached value is undefined', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            baseBranchSha: 'base_sha',
            baseBranch: 'base_foo',
            sha: 'sha',
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo', 'base_foo')).toBeNull();
    });

    it('returns cached value', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo',
            baseBranchSha: 'base_sha',
            baseBranch: 'base_foo',
            sha: 'sha',
            isBehindBase: true,
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedBehindBaseResult('foo', 'base_foo')).toBeTrue();
    });
  });

  describe('setCachedBehindBasedResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Branch cache not present for foo'
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedBehindBaseResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Branch cache not present for foo'
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
