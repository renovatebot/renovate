import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as cleanup from './prune';

jest.mock('../../../util/git');

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
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(0);
    });

    it('returns if no renovate branches', async () => {
      config.branchList = [];
      git.getBranchList.mockReturnValueOnce([]);
      await expect(
        cleanup.pruneStaleBranches(config, config.branchList)
      ).resolves.not.toThrow();
    });

    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });

    it('skips rename but still deletes branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({
        title: 'foo - autoclosed',
      } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });

    it('does nothing on dryRun', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('does nothing on prune stale branches disabled', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.pruneStaleBranches = false;
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('posts comment if someone pushed to PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });

    it('skips comment if dry run', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce({ title: 'foo' } as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    });

    it('dry run delete branch no PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce(null as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('delete branch no PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      platform.findPr.mockResolvedValueOnce(null as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('does not delete modified orphan branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c'])
      );
      git.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce(null as never);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
  });
});
