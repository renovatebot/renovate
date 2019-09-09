const moment = require('moment');
/** @type any */
const limits = require('../../../../lib/workers/repository/process/limits');

/** @type any */
const { platform } = require('../../../../lib/platform');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../../config/config/_fixtures') };
});

describe('workers/repository/process/limits', () => {
  describe('getPrHourlyRemaining()', () => {
    it('calculates hourly limit remaining', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockReturnValueOnce([
        { created_at: moment().format() },
      ]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(1);
    });
    it('returns 99 if errored', async () => {
      config.prHourlyLimit = 2;
      platform.getPrList.mockReturnValueOnce([null]);
      const res = await limits.getPrHourlyRemaining(config);
      expect(res).toEqual(99);
    });
  });
  describe('getConcurrentPrsRemaining()', () => {
    it('calculates concurrent limit remaining', async () => {
      config.prConcurrentLimit = 20;
      platform.branchExists.mockReturnValueOnce(true);
      const branches = [{}, {}];
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
      limits.getPrHourlyRemaining = jest.fn(() => 5);
      limits.getConcurrentPrsRemaining = jest.fn(() => 10);
      const res = await limits.getPrsRemaining();
      expect(res).toEqual(5);
    });
    it('returns concurrent limit', async () => {
      limits.getPrHourlyRemaining = jest.fn(() => 10);
      limits.getConcurrentPrsRemaining = jest.fn(() => 5);
      const res = await limits.getPrsRemaining();
      expect(res).toEqual(5);
    });
  });
});
