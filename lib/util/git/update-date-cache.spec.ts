import { DateTime } from 'luxon';
import { logger, partial } from '~test/util.ts';
import * as _repositoryCache from '../cache/repository/index.ts';
import type { BranchCache, RepoCacheData } from '../cache/repository/types.ts';
import {
  getCachedUpdateDateResult,
  setCachedUpdateDateResult,
} from './update-date-cache.ts';

vi.mock('../cache/repository/index.ts');
const repositoryCache = vi.mocked(_repositoryCache);

describe('util/git/update-date-cache', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedUpdateDateResult', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedUpdateDateResult('foo', 'aaa')).toBeNull();
    });

    it('returns null if branch not found', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'not_foo', sha: 'aaa' }),
      ];
      expect(getCachedUpdateDateResult('foo', 'aaa')).toBeNull();
    });

    it('returns null if branchSha is null', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      expect(getCachedUpdateDateResult('foo', null)).toBeNull();
    });

    it('returns null if branch SHA has changed', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          sha: 'aaa',
          commitTimestamp: '2023-05-20T14:25:30.123Z',
        }),
      ];
      expect(getCachedUpdateDateResult('foo', 'bbb')).toBeNull();
    });

    it('returns null if commitTimestamp is not set', () => {
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      expect(getCachedUpdateDateResult('foo', 'aaa')).toBeNull();
    });

    it('returns cached value', () => {
      const timestamp = '2023-05-20T14:25:30.123Z';
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          sha: 'aaa',
          commitTimestamp: timestamp,
        }),
      ];
      const result = getCachedUpdateDateResult('foo', 'aaa');
      expect(result).toBeInstanceOf(DateTime);
      expect(result!.toISO()).toBe(DateTime.fromISO(timestamp).toISO());
    });
  });

  describe('setCachedUpdateDateResult', () => {
    it('returns without updating when cache not populated', () => {
      setCachedUpdateDateResult(
        'foo',
        DateTime.fromISO('2023-05-20T14:25:30.123Z'),
      );
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledExactlyOnceWith(
        'setCachedUpdateDateResult(): Branch cache not present',
      );
    });

    it('returns without updating when branch not found', () => {
      setCachedUpdateDateResult(
        'foo',
        DateTime.fromISO('2023-05-20T14:25:30.123Z'),
      );
      expect(repoCache).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledExactlyOnceWith(
        'setCachedUpdateDateResult(): Branch cache not present',
      );
    });

    it('updates commitTimestamp', () => {
      const timestamp = '2023-05-20T14:25:30.123Z';
      repoCache.branches = [
        partial<BranchCache>({ branchName: 'foo', sha: 'aaa' }),
      ];
      setCachedUpdateDateResult('foo', DateTime.fromISO(timestamp));
      expect(repoCache.branches).toEqual([
        partial<BranchCache>({
          branchName: 'foo',
          sha: 'aaa',
          commitTimestamp: DateTime.fromISO(timestamp).toISO()!,
        }),
      ]);
    });

    it('handles multiple branches', () => {
      const timestamp1 = '2023-05-20T14:25:30.123Z';
      const timestamp2 = '2023-06-15T09:10:00.000Z';
      repoCache = {
        branches: [
          partial<BranchCache>({ branchName: 'foo-1', sha: '111' }),
          partial<BranchCache>({ branchName: 'foo-2', sha: 'aaa' }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedUpdateDateResult('foo-1', DateTime.fromISO(timestamp1));
      setCachedUpdateDateResult('foo-2', DateTime.fromISO(timestamp2));
      expect(repoCache.branches).toEqual([
        partial<BranchCache>({
          branchName: 'foo-1',
          sha: '111',
          commitTimestamp: DateTime.fromISO(timestamp1).toISO()!,
        }),
        partial<BranchCache>({
          branchName: 'foo-2',
          sha: 'aaa',
          commitTimestamp: DateTime.fromISO(timestamp2).toISO()!,
        }),
      ]);
    });
  });
});
