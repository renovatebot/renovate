import { DateTime } from 'luxon';
import {
  RenovateConfig,
  getConfig,
  getName,
  git,
  platform,
} from '../../../../test/util';
import { PrState } from '../../../types';
import type { BranchConfig } from '../../types';
import * as limits from './limits';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(__filename), () => {
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
        branchPrefix: 'foo/',
        onboardingBranch: 'bar/configure',
      });
      expect(res).toEqual(7);
    });
    it('returns prHourlyLimit if errored', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockRejectedValue('Unknown error');
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(2);
    });
    it('returns 99 if no hourly limit', async () => {
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(99);
    });
  });
  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.prConcurrentLimit = 20;
      platform.getBranchPr.mockImplementation((branchName) =>
        branchName
          ? Promise.resolve({
              sourceBranch: branchName,
              state: PrState.Open,
            } as never)
          : Promise.reject('some error')
      );
      const branches: BranchConfig[] = [
        { branchName: 'test' },
        { branchName: null },
      ] as never;
      const res = await limits.getConcurrentPrsRemaining(config, branches);
      expect(res).toEqual(19);
    });
    it('returns 99 if no concurrent limit', async () => {
      const res = await limits.getConcurrentPrsRemaining(config, []);
      expect(res).toEqual(99);
    });
  });

  describe('getPrsRemaining()', () => {
    it('returns hourly limit', async () => {
      config.prHourlyLimit = 5;
      platform.getPrList.mockResolvedValueOnce([]);
      const res = await limits.getPrsRemaining(config, []);
      expect(res).toEqual(5);
    });
    it('returns concurrent limit', async () => {
      config.prConcurrentLimit = 5;
      const res = await limits.getPrsRemaining(config, []);
      expect(res).toEqual(5);
    });
  });

  describe('getConcurrentBranchesRemaining()', () => {
    it('calculates concurrent limit remaining', () => {
      config.branchConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const res = limits.getConcurrentBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toEqual(19);
    });
    it('defaults to prConcurrentLimit', () => {
      config.branchConcurrentLimit = null;
      config.prConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const res = limits.getConcurrentBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toEqual(19);
    });
    it('does not use prConcurrentLimit for explicit branchConcurrentLimit=0', () => {
      config.branchConcurrentLimit = 0;
      config.prConcurrentLimit = 20;
      const res = limits.getConcurrentBranchesRemaining(config, []);
      expect(res).toEqual(99);
    });
    it('returns 99 if no limits are set', () => {
      const res = limits.getConcurrentBranchesRemaining(config, []);
      expect(res).toEqual(99);
    });
    it('returns prConcurrentLimit if errored', () => {
      config.branchConcurrentLimit = 2;
      const res = limits.getConcurrentBranchesRemaining(config, null);
      expect(res).toEqual(2);
    });
  });

  describe('getBranchesRemaining()', () => {
    it('returns concurrent branches', () => {
      config.branchConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const res = limits.getBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toEqual(19);
    });
  });
});
