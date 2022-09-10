import { mocked, partial } from '../../../test/util';
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
  });

  describe('getCachedModifiedResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns null if branch not found', () => {
      repoCache.branches = [
        { branchName: 'not_foo', sha: 'aaa' } as BranchCache,
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns null if branch is undefined', () => {
      repoCache.branches = [{ branchName: 'foo' } as BranchCache];
      expect(getCachedModifiedResult('foo', '222')).toBeNull();
    });

    it('returns null if branch sha does not match', () => {
      repoCache.branches = [{ branchName: 'foo', sha: '111' } as BranchCache];
      expect(getCachedModifiedResult('foo', '222')).toBeNull();
    });

    it('returns null if isModified doesn not exist', () => {
      repoCache.branches = [{ branchName: 'foo', sha: '111' } as BranchCache];
      expect(getCachedModifiedResult('foo', '111')).toBeNull();
    });

    it('returns true', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: '111', isModified: true } as BranchCache,
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeTrue();
    });

    it('returns false', () => {
      repoCache.branches = [
        { branchName: 'foo', sha: '111', isModified: false } as BranchCache,
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeFalse();
    });
  });

  describe('setCachedModifiedResult', () => {
    it('returns if branch not found', () => {
      git.getBranchCommit.mockReturnValueOnce('SHA');
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({});
    });

    it('handles multiple branches', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo-1',
          sha: 'SHA',
          isModified: true,
        }),
        partial<BranchCache>({
          branchName: 'foo-2',
          sha: 'SHA',
          isModified: false,
        }),
      ];

      git.getBranchCommit.mockReturnValue('SHA');
      setCachedModifiedResult('foo-1', false);
      setCachedModifiedResult('foo-2', true);
      expect(repoCache).toEqual({
        branches: [
          { branchName: 'foo-1', sha: 'SHA', isModified: false },
          { branchName: 'foo-2', sha: 'SHA', isModified: true },
        ],
      });
    });
  });
});
