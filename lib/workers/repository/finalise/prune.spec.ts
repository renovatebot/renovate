import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../test/util';
import { PLATFORM_TYPE_GITHUB } from '../../../constants/platforms';
import * as cleanup from './prune';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.platform = PLATFORM_TYPE_GITHUB;
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/finalise/prune', () => {
  describe('pruneStaleBranches()', () => {
    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(0);
    });
    it('returns if no renovate branches', async () => {
      config.branchList = [];
      git.getAllRenovateBranches.mockResolvedValueOnce([]);
      await expect(
        cleanup.pruneStaleBranches(config, config.branchList)
      ).resolves.not.toThrow();
    });
    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getAllRenovateBranches.mockResolvedValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
    });
    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('does nothing on dryRun', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = true;
      git.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('does nothing on prune stale branches disabled', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = false;
      config.pruneStaleBranches = false;
      git.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('posts comment if someone pushed to PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = false;
      git.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('skips comment if dry run', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.dryRun = true;
      git.getAllRenovateBranches.mockResolvedValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getAllRenovateBranches).toHaveBeenCalledTimes(1);
      expect(platform.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    });
  });
});
