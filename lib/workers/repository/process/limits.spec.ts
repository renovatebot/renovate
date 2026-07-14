import { DateTime } from 'luxon';
import type { RenovateConfig } from '~test/util.ts';
import { partial, platform, scm } from '~test/util.ts';
import type { Pr } from '../../../modules/platform/types.ts';
import * as _repositoryCache from '../../../util/cache/repository/index.ts';
import type { BranchConfig } from '../../types.ts';
import * as limits from './limits.ts';

vi.mock('../../../util/cache/repository/index.ts');
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
    it('calculates hourly commit count from SCM in a single batched call', async () => {
      const time = DateTime.local();
      scm.getAllBranchUpdateDates.mockResolvedValueOnce(
        new Map([
          ['foo/test-1', time],
          ['foo/test-2', time],
          ['foo/test-3', time.minus({ hours: 1 })],
          ['foo/test-4', time],
        ]),
      );
      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
        { branchName: 'foo/test-2' },
        { branchName: 'foo/test-3' },
        { branchName: 'foo/test-4' },
      ] as never);
      expect(res).toBe(3);
      expect(scm.getAllBranchUpdateDates).toHaveBeenCalledTimes(1);
    });

    it('uses cache when available and falls back to a single batched SCM call when missing', async () => {
      const currentTime = DateTime.utc();
      const oldTime = currentTime.minus({ hours: 2 });

      // Mock cache with mixed data: some cached, some missing
      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo/test-1',
            commitTimestamp: currentTime.toISO(),
          },
          {
            branchName: 'foo/test-2',
            commitTimestamp: oldTime.toISO(),
          },
          {
            branchName: 'foo/test-3',
            // no commitTimestamp - will fall back to SCM
          },
        ],
      } as never);

      scm.getAllBranchUpdateDates.mockResolvedValueOnce(
        new Map([['foo/test-3', currentTime]]),
      );

      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
        { branchName: 'foo/test-2' },
        { branchName: 'foo/test-3' },
      ] as never);

      // Should count 2 (test-1 from cache and test-3 from SCM are in current hour)
      expect(res).toBe(2);
      // Should call the batched SCM lookup only once, regardless of how many branches are missing from the cache
      expect(scm.getAllBranchUpdateDates).toHaveBeenCalledTimes(1);
    });

    it('does not call SCM at all when every branch is already cached', async () => {
      const currentTime = DateTime.utc();

      repositoryCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'foo/test-1',
            commitTimestamp: currentTime.toISO(),
          },
        ],
      } as never);

      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
      ] as never);

      expect(res).toBe(1);
      expect(scm.getAllBranchUpdateDates).not.toHaveBeenCalled();
    });

    it('treats a branch missing from the batched result as having no commit this hour', async () => {
      scm.getAllBranchUpdateDates.mockResolvedValueOnce(new Map());
      const res = await limits.getCommitsHourlyCount([
        { branchName: 'foo/test-1' },
      ] as never);
      expect(res).toBe(0);
    });

    it('returns zero if errored', async () => {
      scm.getAllBranchUpdateDates.mockRejectedValue('Unknown error');
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
