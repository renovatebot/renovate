import { logger, mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedModifiedResult,
  setCachedModifiedResult,
} from './modified-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/modified-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedModifiedResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedModifiedResult('foo', 'aaa')).toBeNull();
    });

    it('returns null if branch not found', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'not_foo', sha: 'aaa' }),
      ];
      expect(getCachedModifiedResult('foo', 'aaa')).toBeNull();
    });

    it('returns null if branch SHA has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      expect(getCachedModifiedResult('foo', 'not_aaa')).toBeNull();
    });

    it('returns null if cached value is undefined', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      expect(getCachedModifiedResult('foo', 'aaa')).toBeNull();
    });

    it('returns null if branch sha is null', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      expect(getCachedModifiedResult('foo', null)).toBeNull();
    });

    it('returns cached value', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          sha: '111',
          isModified: true,
        }),
      ];
      expect(getCachedModifiedResult('foo', '111')).toBeTrue();
    });
  });

  describe('setCachedModifiedResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedModifiedResult(): Branch cache not present',
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedModifiedResult('foo', false);
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedModifiedResult(): Branch cache not present',
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
