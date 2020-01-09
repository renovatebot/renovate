import * as cleanup from '../../../../lib/workers/repository/finalise/prune';
import { platform, RenovateConfig, getConfig } from '../../../util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
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
      platform.getAllRenovateBranches.mockResolvedValueOnce([]);
      await cleanup.pruneStaleBranches(config, config.branchList);
    });
    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      platform.getAllRenovateBranches.mockResolvedValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
    });
    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      platform.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('does nothing on dryRun', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = true;
      platform.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('does nothing on prune stale branches disabled', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = false;
      config.pruneStaleBranches = false;
      platform.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('posts comment if someone pushed to PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = false;
      platform.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({ isModified: true } as never);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('skips comment if dry run', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = true;
      platform.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({ isModified: true } as never);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    });
  });
});
