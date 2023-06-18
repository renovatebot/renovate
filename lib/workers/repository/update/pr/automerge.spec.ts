import { partial, platform, scm } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';
import * as schedule from '../branch/schedule';
import * as prAutomerge from './automerge';

describe('workers/repository/update/pr/automerge', () => {
  describe('checkAutoMerge(pr, config)', () => {
    const spy = jest.spyOn(schedule, 'isScheduledNow');
    let config: BranchConfig;
    let pr: Pr;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        branchName: 'renovate/pin',
        upgrades: [],
      } satisfies BranchConfig;
      pr = partial<Pr>();
    });

    it('should not automerge if not configured', async () => {
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('should not automerge if off schedule', async () => {
      spy.mockReturnValueOnce(false);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('should automerge if enabled and pr is mergeable', async () => {
      config.automerge = true;
      config.pruneBranchAfterAutomerge = true;
      platform.getBranchStatus.mockResolvedValueOnce('green');
      platform.mergePr.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({ automerged: true, branchRemoved: true });
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });

    it('should indicate if automerge failed', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce('green');
      platform.mergePr.mockResolvedValueOnce(false);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'PlatformRejection',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });

    it('should automerge comment', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      platform.getBranchStatus.mockResolvedValueOnce('green');
      platform.ensureComment.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({ automerged: true, branchRemoved: false });
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });

    it('should remove previous automerge comment when rebasing', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      config.rebaseRequested = true;
      platform.getBranchStatus.mockResolvedValueOnce('green');
      platform.ensureComment.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({ automerged: true, branchRemoved: false });
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });

    it('should skip branch deletion after automerge if prune is disabled', async () => {
      config.automerge = true;
      config.pruneBranchAfterAutomerge = false;
      platform.getBranchStatus.mockResolvedValueOnce('green');
      platform.mergePr.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({ automerged: true, branchRemoved: false });
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });

    it('should not automerge if enabled and pr is mergeable but cannot rebase', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce('green');
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'BranchModified',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce('yellow');
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'BranchNotGreen',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automerge = true;
      pr.cannotMergeReason = 'some reason';
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'PlatformNotReady',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'Conflicted',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('dryRun full should not automerge', async () => {
      config.automerge = true;
      GlobalConfig.set({ dryRun: 'full' });
      platform.getBranchStatus.mockResolvedValueOnce('green');
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual({
        automerged: false,
        prAutomergeBlockReason: 'DryRun',
      });
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });

    it('dryRun full pr-comment', async () => {
      config.automergeType = 'pr-comment';
      const expectedResult = {
        automerged: false,
        prAutomergeBlockReason: 'DryRun',
      };
      platform.getBranchStatus.mockResolvedValueOnce('green');
      GlobalConfig.set({ dryRun: 'full' });
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toEqual(expectedResult);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
  });
});
