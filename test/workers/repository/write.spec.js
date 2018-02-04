const { writeUpdates } = require('../../../lib/workers/repository/write');
const branchWorker = require('../../../lib/workers/branch');
const moment = require('moment');

branchWorker.processBranch = jest.fn();

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../_fixtures/config') };
});

describe('workers/repository/write', () => {
  describe('writeUpdates()', () => {
    it('calculates hourly limit remaining', async () => {
      config.branches = [];
      config.prHourlyLimit = 1;
      platform.getPrList.mockReturnValueOnce([
        { created_at: moment().format() },
      ]);
      const res = await writeUpdates(config);
      expect(res).toEqual('done');
    });
    it('calculates concurrent limit remaining', async () => {
      config.branches = ['renovate/chalk-2.x'];
      config.prConcurrentLimit = 1;
      platform.getPrList.mockReturnValueOnce([
        { created_at: moment().format() },
      ]);
      platform.branchExists.mockReturnValueOnce(true);
      const res = await writeUpdates(config);
      expect(res).toEqual('done');
    });
    it('handles error in calculation', async () => {
      config.branches = [];
      config.prHourlyLimit = 1;
      platform.getPrList.mockReturnValueOnce([{}, null]);
      const res = await writeUpdates(config);
      expect(res).toEqual('done');
    });
    it('runs pins first', async () => {
      config.branches = [{ isPin: true }, {}, {}];
      const res = await writeUpdates(config);
      expect(res).toEqual('done');
      expect(branchWorker.processBranch.mock.calls).toHaveLength(1);
    });
    it('stops after automerge', async () => {
      config.branches = [{}, {}, {}];
      branchWorker.processBranch.mockReturnValueOnce('created');
      branchWorker.processBranch.mockReturnValueOnce('automerged');
      const res = await writeUpdates(config);
      expect(res).toEqual('automerged');
      expect(branchWorker.processBranch.mock.calls).toHaveLength(2);
    });
  });
});
