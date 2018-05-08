const {
  processRepo,
} = require('../../../../lib/workers/repository/process/index');
const extractUpdate = require('../../../../lib/workers/repository/process/extract-update');

jest.mock('../../../../lib/workers/repository/process/extract-update');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await processRepo(config);
      expect(res).toMatchSnapshot();
    });
    it('processes baseBranches', async () => {
      extractUpdate.extractAndUpdate.mockReturnValue({});
      config.baseBranches = ['branch1', 'branch2'];
      const res = await processRepo(config);
      expect(res).toMatchSnapshot();
    });
  });
});
