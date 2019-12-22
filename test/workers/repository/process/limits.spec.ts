import moment from 'moment';
import * as limits from '../../../../lib/workers/repository/process/limits';
import { platform, getConfig, RenovateConfig } from '../../../util';

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
          created_at: moment().format(),
          branchName: null,
          title: null,
          state: null,
        },
      ]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(1);
    });
    it('returns 99 if errored', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockResolvedValueOnce([null]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(99);
    });
  });
  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.prConcurrentLimit = 20;
      platform.branchExists.mockResolvedValueOnce(true);
      const branches = [{ branchName: 'test' }, { branchName: undefined }];
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
});
