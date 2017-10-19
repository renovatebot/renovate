const defaultConfig = require('../../../lib/config/defaults').getConfig();
const cleanup = require('../../../lib/workers/repository/cleanup');
const logger = require('../../_fixtures/logger');

describe('workers/repository/cleanup', () => {
  describe('pruneStaleBranches(config, branchUpgradeNames)', () => {
    let branchNames;
    let config;
    beforeEach(() => {
      branchNames = [];
      config = { ...defaultConfig };
      config.api = {
        getAllRenovateBranches: jest.fn(),
        getPr: jest.fn(),
        deleteBranch: jest.fn(),
        findPr: jest.fn(),
        updatePr: jest.fn(),
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
    });
    it('renames deletes remaining branch', async () => {
      branchNames = ['renovate/a', 'renovate/b'];
      config.api.getAllRenovateBranches.mockReturnValueOnce(
        branchNames.concat(['renovate/c'])
      );
      config.api.findPr.mockReturnValueOnce({});
      await cleanup.pruneStaleBranches(config, branchNames);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
      expect(config.api.updatePr.mock.calls).toHaveLength(1);
    });
    it('deletes lock file maintenance if pr is closed', async () => {
      branchNames = ['renovate/lock-file-maintenance'];
      config.api.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      config.api.getBranchPr = jest.fn(() => ({ isClosed: true }));
      await cleanup.pruneStaleBranches(config, [
        'renovate/lock-file-maintenance',
      ]);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
    it('deletes lock file maintenance if pr is unmergeable', async () => {
      branchNames = ['renovate/lock-file-maintenance'];
      config.api.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      config.api.getBranchPr = jest.fn(() => ({ isUnmergeable: true }));
      await cleanup.pruneStaleBranches(config, [
        'renovate/lock-file-maintenance',
      ]);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
    it('deletes lock file maintenance if no changed files', async () => {
      branchNames = ['renovate/lock-file-maintenance'];
      config.api.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      config.api.getBranchPr = jest.fn(() => ({ changed_files: 0 }));
      await cleanup.pruneStaleBranches(config, [
        'renovate/lock-file-maintenance',
      ]);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
    it('calls delete only once', async () => {
      branchNames = ['renovate/lock-file-maintenance'];
      config.api.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      config.api.getBranchPr = jest.fn(() => ({ isClosed: true }));
      await cleanup.pruneStaleBranches(config, []);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
  });
});
