const cleanup = require('../../../../lib/workers/repository/finalise/prune');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
  config.platform = 'github';
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/finalise/prune', () => {
  describe('pruneStaleBranches()', () => {
    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches.mock.calls).toHaveLength(0);
    });
    it('returns if no renovate branches', async () => {
      config.branchList = [];
      platform.getAllRenovateBranches.mockReturnValueOnce([]);
      await cleanup.pruneStaleBranches(config, config.branchList);
    });
    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      platform.getAllRenovateBranches.mockReturnValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(platform.deleteBranch.mock.calls).toHaveLength(0);
    });
    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      platform.getAllRenovateBranches.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockReturnValueOnce({});
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(platform.deleteBranch.mock.calls).toHaveLength(1);
      expect(platform.updatePr.mock.calls).toHaveLength(1);
    });
    it('deletes lock file maintenance if pr is unmergeable', async () => {
      config.branchList = ['renovate/lock-file-maintenance'];
      platform.getAllRenovateBranches.mockReturnValueOnce([
        'renovate/lock-file-maintenance',
      ]);
      platform.getBranchPr = jest.fn(() => ({ isConflicted: true }));
      await cleanup.pruneStaleBranches(config, [
        'renovate/lock-file-maintenance',
      ]);
      expect(platform.getAllRenovateBranches.mock.calls).toHaveLength(1);
      expect(platform.deleteBranch.mock.calls).toHaveLength(1);
    });
  });
});
