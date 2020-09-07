import moment from 'moment';
import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../test/util';
import { PrState } from '../../../types';
import * as limits from './limits';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('workers/repository/process/limits', () => {
  describe('getPrHourlyRemaining()', () => {
    it('calculates hourly limit remaining', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockResolvedValueOnce([
        {
          createdAt: moment().toISOString(),
          branchName: null,
          title: null,
          state: null,
        },
      ]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(1);
    });
    it('returns prHourlyLimit if errored', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockResolvedValueOnce([null]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(2);
    });
  });
  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.prConcurrentLimit = 20;
      platform.getPrList.mockResolvedValueOnce([
        { branchName: 'test1', state: PrState.Open },
        { branchName: 'test2', state: PrState.Closed },
        { branchName: undefined, upgrades: [] },
      ] as never);
      const res = await limits.getConcurrentPrsRemaining(config);
      expect(res).toEqual(19);
    });
    it('returns 99 if no concurrent limit', async () => {
      const res = await limits.getConcurrentPrsRemaining(config);
      expect(res).toEqual(99);
    });
    it('returns prConcurrentLimit if errored', async () => {
      config.prConcurrentLimit = 2;
      platform.getPrList.mockResolvedValueOnce([null]);
      const res = await limits.getConcurrentPrsRemaining(config);
      expect(res).toEqual(2);
    });
  });

  describe('getPrsRemaining()', () => {
    it('returns hourly limit', async () => {
      config.prHourlyLimit = 5;
      platform.getPrList.mockResolvedValueOnce([]);
      const res = await limits.getPrsRemaining(config);
      expect(res).toEqual(5);
    });
    it('returns concurrent limit', async () => {
      config.prConcurrentLimit = 5;
      platform.getPrList.mockResolvedValueOnce([]);
      const res = await limits.getPrsRemaining(config);
      expect(res).toEqual(5);
    });
  });

  describe('getBranchesRemaining()', () => {
    it('calculates concurrent limit remaining', () => {
      config.branchConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const res = limits.getBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toEqual(19);
    });
    it('defaults to prConcurrentLimit', () => {
      config.branchConcurrentLimit = null;
      config.prConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const res = limits.getBranchesRemaining(config, [
        { branchName: 'foo' },
      ] as never);
      expect(res).toEqual(19);
    });
    it('does not use prConcurrentLimit for explicit branchConcurrentLimit=0', () => {
      config.branchConcurrentLimit = 0;
      config.prConcurrentLimit = 20;
      const res = limits.getBranchesRemaining(config, [] as never);
      expect(res).toEqual(99);
    });
    it('returns 99 if no limits are set', () => {
      const res = limits.getBranchesRemaining(config, []);
      expect(res).toEqual(99);
    });
    it('returns prConcurrentLimit if errored', () => {
      config.branchConcurrentLimit = 2;
      const res = limits.getBranchesRemaining(config, null);
      expect(res).toEqual(2);
    });
  });
});
