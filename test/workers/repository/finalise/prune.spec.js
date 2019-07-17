const cleanup = require('../../../../lib/workers/repository/finalise/prune');

/** @type any */
const platform = global.platform;

/** @type any */
let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../config/config/_fixtures');
  config.platform = 'github';
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/finalise/prune', () => {
  describe('pruneStaleBranches()', () => {
    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(0);
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
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
    });
    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      platform.getAllRenovateBranches.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockReturnValueOnce({ title: 'foo' });
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('does nothing on dryRun', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = true;
      platform.getAllRenovateBranches.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockReturnValueOnce({ title: 'foo' });
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('does nothing on prune stale branches disabled', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.pruneStaleBranches = false;
      platform.getAllRenovateBranches.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockReturnValueOnce({ title: 'foo' });
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
  });
});
