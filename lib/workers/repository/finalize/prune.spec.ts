import type { RenovateConfig } from '~test/util.ts';
import { git, partial, platform, scm } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { Pr } from '../../../modules/platform/types.ts';
import * as cleanup from './prune.ts';

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({
    repoIsOnboarded: true,
    defaultBranch: 'main',
    branchPrefix: `renovate/`,
    pruneStaleBranches: true,
  });
});

describe('workers/repository/finalize/prune', () => {
  describe('pruneStaleBranches()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns if no branchList', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(0);
    });

    it('ignores reconfigure branch', async () => {
      delete config.branchList;
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(0);
    });

    it('returns if no defaultBranch', async () => {
      delete config.defaultBranch;
      config.branchList = [];
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(0);
    });

    it('returns if branchPrefix is empty', async () => {
      config.branchPrefix = '';
      config.branchList = ['main/quality/renovate-a'];
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('returns if no renovate branches', async () => {
      config.branchList = [];
      git.getBranchList.mockReturnValueOnce([]);
      await expect(
        cleanup.pruneStaleBranches(config, config.branchList),
      ).resolves.not.toThrow();
    });

    it('returns if no remaining branches', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(config.branchList);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('renames deletes remaining branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      const pr = partial<Pr>({ state: 'open', title: 'foo' });
      platform.findPr.mockResolvedValueOnce(pr);
      platform.getPr.mockResolvedValueOnce(pr);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });

    it('skips rename but still deletes branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      const pr = partial<Pr>({
        state: 'open',
        title: 'foo - autoclosed',
      });
      platform.findPr.mockResolvedValueOnce(pr);
      platform.getPr.mockResolvedValueOnce(pr);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });

    it('deletes with base branches', async () => {
      config.branchList = ['renovate/main-a'];
      config.baseBranchPatterns = ['/main.*/'];
      config.baseBranches = ['main', 'maint/v7'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat([
          'renovate/main-b',
          'renovate/maint/v7-a',
          'renovate/maint/v7-b',
        ]),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      scm.isBranchModified.mockResolvedValueOnce(false);
      scm.isBranchModified.mockResolvedValueOnce(true);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/maint/v7-a',
      );
      expect(scm.isBranchModified).toHaveBeenCalledTimes(3);

      expect(scm.isBranchModified).toHaveBeenCalledWith(
        'renovate/main-b',
        'main',
      );

      expect(scm.isBranchModified).toHaveBeenCalledWith(
        'renovate/maint/v7-a',
        'maint/v7',
      );

      expect(scm.isBranchModified).toHaveBeenCalledWith(
        'renovate/maint/v7-b',
        'maint/v7',
      );
    });

    it('uses single configured base branch instead of defaultBranch', async () => {
      config.branchList = [];
      config.baseBranchPatterns = ['renovate-updates'];
      config.baseBranches = ['renovate-updates'];
      config.defaultBranch = 'main';
      git.getBranchList.mockReturnValueOnce(['renovate/dayjs-1.x']);
      platform.findPr.mockResolvedValueOnce(null);

      await cleanup.pruneStaleBranches(config, config.branchList);

      expect(platform.findPr).toHaveBeenCalledExactlyOnceWith({
        branchName: 'renovate/dayjs-1.x',
        state: 'open',
        targetBranch: 'renovate-updates',
      });
      expect(scm.isBranchModified).toHaveBeenCalledExactlyOnceWith(
        'renovate/dayjs-1.x',
        'renovate-updates',
      );
    });

    it('uses defaultBranch when baseBranchPatterns exist but baseBranches are not computed yet', async () => {
      config.branchList = [];
      config.baseBranchPatterns = ['/^release\\/.*/'];
      config.defaultBranch = 'main';
      git.getBranchList.mockReturnValueOnce([
        'renovate/release/1.x-dependency',
      ]);
      platform.findPr.mockResolvedValueOnce(null);

      await expect(
        cleanup.pruneStaleBranches(config, config.branchList),
      ).resolves.not.toThrow();

      expect(platform.findPr).toHaveBeenCalledExactlyOnceWith({
        branchName: 'renovate/release/1.x-dependency',
        state: 'open',
        targetBranch: 'main',
      });
      expect(scm.isBranchModified).toHaveBeenCalledExactlyOnceWith(
        'renovate/release/1.x-dependency',
        'main',
      );
      expect(scm.deleteBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/release/1.x-dependency',
      );
    });

    it('does nothing on dryRun', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ title: 'foo' }));
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('does nothing on prune stale branches disabled', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      config.pruneStaleBranches = false;
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ title: 'foo' }));
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('notifies via PR changes if someone pushed to PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.getBranchPr.mockResolvedValueOnce(partial<Pr>());
      scm.isBranchModified.mockResolvedValueOnce(true);
      const pr = partial<Pr>({ state: 'open', title: 'foo' });
      platform.findPr.mockResolvedValueOnce(pr);
      platform.getPr.mockResolvedValueOnce(pr);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });

    it('skips appending - abandoned to PR title if already present', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.getBranchPr.mockResolvedValueOnce(partial<Pr>());
      scm.isBranchModified.mockResolvedValueOnce(true);
      const pr = partial<Pr>({ state: 'open', title: 'foo - abandoned' });
      platform.findPr.mockResolvedValueOnce(pr);
      platform.getPr.mockResolvedValueOnce(pr);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('does not update a PR that was merged after the PR list was cached', async () => {
      config.branchList = [];
      git.getBranchList.mockReturnValueOnce(['renovate/a']);
      platform.findPr.mockResolvedValueOnce(
        partial<Pr>({ number: 1, state: 'open', title: 'foo' }),
      );
      platform.getPr.mockResolvedValueOnce(
        partial<Pr>({ number: 1, state: 'merged', title: 'foo' }),
      );

      await cleanup.pruneStaleBranches(config, config.branchList);

      expect(platform.getPr).toHaveBeenCalledExactlyOnceWith(1, true);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledExactlyOnceWith('renovate/a');
    });

    it('skips pruning when a cached PR cannot be refreshed', async () => {
      config.branchList = [];
      git.getBranchList.mockReturnValueOnce(['renovate/a']);
      platform.findPr.mockResolvedValueOnce(
        partial<Pr>({ number: 1, state: 'open', title: 'foo' }),
      );
      platform.getPr.mockResolvedValueOnce(null);

      await cleanup.pruneStaleBranches(config, config.branchList);

      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('skips changes to PR if dry run', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.getBranchPr.mockResolvedValueOnce(partial<Pr>());
      scm.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ title: 'foo' }));
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    });

    it('dry run delete branch no PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      GlobalConfig.set({ dryRun: 'full' });
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.findPr.mockResolvedValueOnce(null);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('delete branch no PR', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      platform.findPr.mockResolvedValueOnce(null);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('does not delete modified orphan branch', async () => {
      config.branchList = ['renovate/a', 'renovate/b'];
      git.getBranchList.mockReturnValueOnce(
        config.branchList.concat(['renovate/c']),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      platform.findPr.mockResolvedValueOnce(null);
      await cleanup.pruneStaleBranches(config, config.branchList);
      expect(git.getBranchList).toHaveBeenCalledTimes(1);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
  });
});
