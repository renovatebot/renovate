const {
  processRepo,
} = require('../../../../lib/workers/repository/process/index');
const extractUpdate = require('../../../../lib/workers/repository/process/extract-update');

jest.mock('../../../../lib/workers/repository/process/extract-update');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../config/config/_fixtures');
});

describe('workers/repository/process/index', () => {
  let config;
  beforeEach(() => {
    config = {};
  });
  describe('processRepo()', () => {
    it('throws if bitbucket with master issue', async () => {
      config.isBitbucket = true;
      config.masterIssue = true;
      await expect(processRepo(config)).rejects.toThrow();
    });
    it('throws if azure with master issue', async () => {
      config.isAzure = true;
      config.masterIssue = true;
      await expect(processRepo(config)).rejects.toThrow();
    });
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
