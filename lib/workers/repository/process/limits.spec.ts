import { DateTime } from 'luxon';
import { RenovateConfig, partial, platform, scm } from '../../../../test/util';
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
  describe('getPrHourlyRemaining()', () => {
    it('calculates hourly limit remaining', async () => {
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
      const res = await limits.getPrHourlyRemaining({
        ...config,
        prHourlyLimit: 10,
      });
      expect(res).toBe(7);
    });

    it('returns prHourlyLimit if errored', async () => {
      config.prHourlyLimit = 5;
      platform.getPrList.mockRejectedValue('Unknown error');
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toBe(5);
    });

    it('returns MAX_SAFE_INTEGER if no hourly limit', async () => {
      config.prHourlyLimit = 0;
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.prConcurrentLimit = 20;
      platform.getBranchPr.mockImplementation((branchName) =>
        branchName
          ? Promise.resolve(
              partial<Pr>({
                sourceBranch: branchName,
                state: 'open',
              }),
            )
          : Promise.reject('some error'),
      );
      const branches: BranchConfig[] = [
        { branchName: 'test' },
        { branchName: null },
      ] as never;
      const res = await limits.getConcurrentPrsRemaining(config, branches);
      expect(res).toBe(19);
    });

    it('returns MAX_SAFE_INTEGER if no concurrent limit', async () => {
      config.prConcurrentLimit = 0;
      const res = await limits.getConcurrentPrsRemaining(config, []);
      expect(res).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('getPrsRemaining()', () => {
    it('returns hourly limit', async () => {
      config.prHourlyLimit = 1;
      platform.getPrList.mockResolvedValueOnce([]);
      const res = await limits.getPrsRemaining(config, []);
      expect(res).toBe(1);
    });

    it('returns concurrent limit', async () => {
      config.prConcurrentLimit = 1;
      const res = await limits.getPrsRemaining(config, []);
      expect(res).toBe(1);
    });
  });

  describe('getConcurrentBranchesRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.branchConcurrentLimit = 20;
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await limits.getConcurrentBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toBe(19);
    });

    it('defaults to prConcurrentLimit', async () => {
      config.branchConcurrentLimit = null;
      config.prConcurrentLimit = 20;
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await limits.getConcurrentBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toBe(19);
    });

    it('does not use prConcurrentLimit for explicit branchConcurrentLimit=0', async () => {
      config.branchConcurrentLimit = 0;
      config.prConcurrentLimit = 20;
      const res = await limits.getConcurrentBranchesRemaining(config, []);
      expect(res).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('returns 10 if no limits are set', async () => {
      const res = await limits.getConcurrentBranchesRemaining(config, []);
      expect(res).toBe(10);
    });

    it('returns prConcurrentLimit if errored', async () => {
      config.branchConcurrentLimit = 2;
      // TODO: #22198
      const res = await limits.getConcurrentBranchesRemaining(
        config,
        null as never,
      );
      expect(res).toBe(2);
    });
  });

  describe('getBranchesRemaining()', () => {
    it('returns minimal of both limits', async () => {
      platform.getPrList.mockResolvedValue([]);

      await expect(
        limits.getBranchesRemaining(
          {
            ...config,
            prHourlyLimit: 3,
            branchConcurrentLimit: 5,
          },
          [],
        ),
      ).resolves.toBe(3);

      await expect(
        limits.getBranchesRemaining(
          {
            ...config,
            prHourlyLimit: 11,
            branchConcurrentLimit: 7,
          },
          [],
        ),
      ).resolves.toBe(7);
    });
  });
});
