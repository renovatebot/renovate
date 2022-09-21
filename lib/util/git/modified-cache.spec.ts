import { logger, mocked, partial } from '../../../test/util';
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
    git.getBranchCommit.mockReturnValue('111');
  });

  describe('getCachedModifiedResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedModifiedResult('foo')).toBeNull();
    });

    it('returns null if branc not found', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'not_foo', sha: 'aaa' }),
      ];
      expect(getCachedModifiedResult('foo')).toBeNull();
    });

    it('returns null if branch SHA has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      git.getBranchCommit.mockReturnValueOnce('not_aaa');
      expect(getCachedModifiedResult('foo')).toBeNull();
    });

    it('returns null if cached value is undefined', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      git.getBranchCommit.mockReturnValueOnce('aaa');
      expect(getCachedModifiedResult('foo')).toBeNull();
    });

    it('returns cached value', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          sha: '111',
          isModified: false,
        }),
      ];
      expect(getCachedModifiedResult('foo')).toBeFalse();
    });
  });

  describe('setCachedModifiedResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Branch cache not present for foo'
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Branch cache not present for foo'
      );
    });

    it('handles multiple branches', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo-1',
            sha: '111',
            isModified: true,
          }),
          partial<BranchCache>({
            branchName: 'foo-2',
            sha: 'aaa',
            isModified: false,
          }),
          partial<BranchCache>({
            branchName: 'foo-3',
            sha: '222',
            isModified: true,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedModifiedResult('foo-1', false);
      setCachedModifiedResult('foo-2', true);
      setCachedModifiedResult('foo-3', false);
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo-1',
            sha: '111',
            isModified: false,
          },
          {
            branchName: 'foo-2',
            sha: 'aaa',
            isModified: true,
          },
          {
            branchName: 'foo-3',
            sha: '222',
            isModified: false,
          },
        ],
      });
    });
  });
});
