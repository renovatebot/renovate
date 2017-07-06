const defaultConfig = require('../../../lib/config/defaults').getConfig();
const cleanup = require('../../../lib/workers/repository/cleanup');
const logger = require('../../_fixtures/logger');

describe('workers/repository/cleanup', () => {
  describe('pruneStaleBranches(config, branchUpgradeNames)', () => {
    let branchNames;
    let config;
    beforeEach(() => {
      branchNames = [];
      config = Object.assign({}, defaultConfig);
      config.api = {
        getAllRenovateBranches: jest.fn(),
        getAllPrs: jest.fn(),
        getPr: jest.fn(),
        deleteBranch: jest.fn(),
      };
      config.logger = logger;
    });
    it('returns if config is not github', async () => {
      config.platform = 'gitlab';
      await cleanup.pruneStaleBranches(config, branchNames);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(0);
    });
    it('returns if no remaining branches', async () => {
      branchNames = ['renovate/a', 'renovate/b'];
      config.api.getAllRenovateBranches.mockReturnValueOnce(branchNames);
      await cleanup.pruneStaleBranches(config, branchNames);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.getAllPrs.mock.calls).toHaveLength(0);
    });
    it('deletes remaining branch', async () => {
      branchNames = ['renovate/a', 'renovate/b'];
      config.api.getAllRenovateBranches.mockReturnValueOnce(
        branchNames.concat(['renovate/c'])
      );
      await cleanup.pruneStaleBranches(config, branchNames);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
  });
});
