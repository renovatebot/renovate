import { DateTime } from 'luxon';
import type { Pr } from '../../../modules/platform/types';
import * as _repositoryCache from '../../../util/cache/repository';
import type { BranchConfig } from '../../types';
import * as limits from './limits';
import { partial, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../util/cache/repository');
const repositoryCache = vi.mocked(_repositoryCache);

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({
    branchPrefix: 'foo/',
    onboardingBranch: 'bar/configure',
    prHourlyLimit: 2,
    prConcurrentLimit: 10,
    branchConcurrentLimit: null,
  });
  repositoryCache.getCache.mockReturnValue({});
});

describe('workers/repository/process/limits', () => {
  describe('getPrHourlyCount()', () => {
    it('calculates hourly pr count', async () => {
      const time = DateTime.local();
      const createdAt = time.toISO();
      platform.getPrList.mockResolvedValueOnce([
        { createdAt, sourceBranch: 'foo/test-1' },
        { createdAt, sourceBranch: 'foo/test-2' },
        { createdAt, sourceBranch: 'foo/test-3' },
        {
          createdAt: time.minus({ hours: 1 }).toISO(),
          sourceBranch: 'foo/test-4',
        },
        { createdAt, sourceBranch: 'bar/configure' },
        { createdAt, sourceBranch: 'baz/test' },
      ] as never);
      const res = await limits.getPrHourlyCount(config);
      expect(res).toBe(3);
    });

    it('returns zero if errored', async () => {
      platform.getPrList.mockRejectedValue('Unknown error');
      const res = await limits.getPrHourlyCount(config);
      expect(res).toBe(0);
    });
  });

  describe('getCommitHourlyCount()', () => {
    it('calculates hourly commit count', async () => {
      const time = DateTime.local();
      scm.getBranchUpdateDate.mockResolvedValueOnce(time);
      scm.getBranchUpdateDate.mockResolvedValueOnce(time);
      scm.getBranchUpdateDate.mockResolvedValueOnce(time.minus({ hours: 1 }));
      scm.getBranchUpdateDate.mockResolvedValueOnce(time);
      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
        { branchName: 'foo/test-2' },
        { branchName: 'foo/test-3' },
        { branchName: 'foo/test-4' },
      ] as never);
      expect(res).toBe(3);
    });

    it('uses cached timestamp when available', async () => {
      const currentTime = DateTime.local().setZone('utc');
      const oldTime = currentTime.minus({ hours: 2 });

      // Mock the cache
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo/test-1',
            commitTimestamp: currentTime.toISO()!,
          },
          {
            branchName: 'foo/test-2',
            commitTimestamp: oldTime.toISO()!,
          },
          {
            branchName: 'foo/test-3',
            commitTimestamp: currentTime.toISO()!,
          },
        ],
      } as never);

      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
        { branchName: 'foo/test-2' },
        { branchName: 'foo/test-3' },
      ] as never);

      // Should count 2 (test-1 and test-3 are in current hour, test-2 is 2 hours old)
      expect(res).toBe(2);
      // Should not call SCM since all timestamps are cached
      expect(scm.getBranchUpdateDate).not.toHaveBeenCalled();
    });

    it('falls back to SCM when cache timestamp is missing', async () => {
      const currentTime = DateTime.local().setZone('utc');

      // Mock the cache with one branch missing timestamp
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo/test-1',
            commitTimestamp: currentTime.toISO()!,
          },
          {
            branchName: 'foo/test-2',
            // no commitTimestamp
          },
        ],
      } as never);

      scm.getBranchUpdateDate.mockResolvedValueOnce(currentTime);

      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
        { branchName: 'foo/test-2' },
      ] as never);

      expect(res).toBe(2);
      // Should call SCM only for test-2
      expect(scm.getBranchUpdateDate).toHaveBeenCalledExactlyOnceWith(
        'foo/test-2',
      );
    });

    it('handles branch not in cache by using SCM', async () => {
      const currentTime = DateTime.local().setZone('utc');

      // Mock empty cache
      repositoryCache.getCache.mockReturnValue({
        branches: [],
      } as never);

      scm.getBranchUpdateDate.mockResolvedValueOnce(currentTime);

      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
      ] as never);

      expect(res).toBe(1);
      expect(scm.getBranchUpdateDate).toHaveBeenCalledExactlyOnceWith(
        'foo/test-1',
      );
    });

    it('returns zero if errored', async () => {
      scm.getBranchUpdateDate.mockRejectedValue('Unknown error');
      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
      ] as never);
      expect(res).toBe(0);
    });
  });

  describe('getConcurrentPrsCount()', () => {
    it('calculates concurrent prs present', async () => {
      platform.getBranchPr.mockImplementation((branchName) =>
        branchName
          ? Promise.resolve(
              partial<Pr>({
                sourceBranch: branchName,
                state: 'open',
              }),
            )
          : Promise.reject(new Error('some error')),
      );
      const branches: BranchConfig[] = [
        { branchName: 'test' },
        { branchName: null },
      ] as never;
      const res = await limits.getConcurrentPrsCount(config, branches);
      expect(res).toBe(1);
    });
  });

  describe('getConcurrentBranchesCount()', () => {
    it('calculates concurrent branches present', async () => {
      scm.branchExists.mockImplementation((branchName) =>
        branchName ? Promise.resolve(true) : Promise.resolve(false),
      );
      const res = await limits.getConcurrentBranchesCount([
        { branchName: 'foo' },
        { branchName: null },
      ] as never);
      expect(res).toBe(1);
    });
  });
});
