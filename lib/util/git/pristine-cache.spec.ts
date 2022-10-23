import { logger, mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import {
  getCachedPristineResult,
  setCachedPristineResult,
} from './pristine-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/pristine-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedPristineResult', () => {
    it('returns false if cache is not populated', () => {
      expect(getCachedPristineResult('foo')).toBeFalse();
    });

    it('returns false if branch not found', () => {
      repoCache.branches = [partial<BranchCache>({ branchName: 'not_foo' })];
      expect(getCachedPristineResult('foo')).toBeFalse();
    });

    it('returns true', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          pristine: true,
        }),
      ];
      expect(getCachedPristineResult('foo')).toBeTrue();
    });
  });

  describe('setCachedPristineResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedPristineResult('foo');
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedPristineResult(): Branch cache not present'
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedPristineResult('foo');
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedPristineResult(): Branch cache not present'
      );
    });

    it('handles multiple branches', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'foo-1',
          }),
          partial<BranchCache>({
            branchName: 'foo-2',
          }),
          partial<BranchCache>({
            branchName: 'foo-3',
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedPristineResult('foo-1');
      setCachedPristineResult('foo-2');
      setCachedPristineResult('foo-3');
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo-1',
            pristine: false,
          },
          {
            branchName: 'foo-2',
            pristine: false,
          },
          {
            branchName: 'foo-3',
            pristine: false,
          },
        ],
      });
    });
  });
});
