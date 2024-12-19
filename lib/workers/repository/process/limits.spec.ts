import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../../test/util';
import { partial, platform, scm } from '../../../../test/util';
import type { Pr } from '../../../modules/platform/types';
import type { BranchConfig } from '../../types';
import * as limits from './limits';

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({
    branchPrefix: 'foo/',
    onboardingBranch: 'bar/configure',
    prHourlyLimit: 2,
    prConcurrentLimit: 10,
    branchConcurrentLimit: null,
  });
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
