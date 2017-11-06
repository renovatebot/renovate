const cleanup = require('../../../lib/workers/repository/cleanup');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
  config.platform = 'github';
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/cleanup', () => {
  describe('pruneStaleBranches()', () => {
    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(0);
    });
    it('returns if config is not github', async () => {
      config.branchList = [];
      config.platform = 'gitlab';
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(0);
    });
    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.api.getAllRenovateBranches.mockReturnValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(0);
    });
    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.api.getAllRenovateBranches.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      config.api.findPr.mockReturnValueOnce({});
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
      expect(config.api.updatePr.mock.calls).toHaveLength(1);
    });
    it('deletes lock file maintenance if pr is unmergeable', async () => {
      config.branchList = ['renovate/lock-file-maintenance'];
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
    it('calls delete only once', async () => {
      config.branchList = ['renovate/lock-file-maintenance'];
      config.api.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      config.api.getBranchPr = jest.fn(() => ({ isUnmergeable: true }));
      await cleanup.pruneStaleBranches(config, []);
      expect(config.api.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(config.api.deleteBranch.mock.calls).toHaveLength(1);
    });
  });
});
