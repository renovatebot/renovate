import moment from 'moment';
import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../test/util';
import { BranchConfig } from '../../common';
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
      config.prHourlyLimit = 42;
      platform.getPrList.mockResolvedValueOnce([null]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(42);
    });
  });
  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', () => {
      config.prConcurrentLimit = 20;
      git.branchExists.mockReturnValueOnce(true);
      const branches: BranchConfig[] = [
        { branchName: 'test', upgrades: [] },
        { branchName: undefined, upgrades: [] },
      ];
      const res = limits.getConcurrentPrsRemaining(config, branches);
      expect(res).toEqual(19);
    });
    it('returns 99 if no concurrent limit', () => {
      const res = limits.getConcurrentPrsRemaining(config, []);
      expect(res).toEqual(99);
    });
    it('returns prConcurrentLimit if errored', () => {
      config.prConcurrentLimit = 42;
      const res = limits.getConcurrentPrsRemaining(config, null as any);
      expect(res).toEqual(42);
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
      platform.getPrList.mockResolvedValueOnce([]);
      const res = await limits.getPrsRemaining(config, []);
      expect(res).toEqual(5);
    });
  });
});
