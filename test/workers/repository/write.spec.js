const { writeUpdates } = require('../../../lib/workers/repository/write');
const branchWorker = require('../../../lib/workers/branch');

branchWorker.processBranch = jest.fn();

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../_fixtures/config') };
});

describe('workers/repository/write', () => {
  describe('writeUpdates()', () => {
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
