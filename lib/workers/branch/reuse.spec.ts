import { getName, git, platform } from '../../../test/util';
import type { RenovateConfig } from '../../config/types';
import { Pr } from '../../platform';
import { PrState } from '../../types';
import { shouldReuseExistingBranch } from './reuse';

jest.mock('../../util/git');

describe(getName(__filename), () => {
  describe('shouldReuseExistingBranch(config)', () => {
    const pr: Pr = {
      sourceBranch: 'master',
      state: PrState.Open,
      title: 'any',
    };
    let config: RenovateConfig;
    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        rebaseLabel: 'rebase',
        rebaseWhen: 'behind-base-branch',
      };
      jest.resetAllMocks();
    });
    it('returns false if branch does not exist', async () => {
      git.branchExists.mockReturnValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns true if no PR', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns true if does not need rebasing', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: false,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns true if unmergeable and cannot rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns true if unmergeable and can rebase, but rebaseWhen is never', async () => {
      config.rebaseWhen = 'never';
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns false if PR title rebase!', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'rebase!Update foo to v4',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns false if PR body check rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- rebase-check -->foo\n',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns false if manual rebase by label', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        labels: ['rebase'],
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns false if unmergeable and can rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns true if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns false if automerge branch and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns true if rebaseWhen=behind-base-branch but cannot rebase', async () => {
      config.rebaseWhen = 'behind-base-branch';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });

    it('returns false if automerge pr and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'pr';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });

    it('returns false if getRepoForceRebase and stale', async () => {
      config.rebaseWhen = 'auto';
      platform.getRepoForceRebase.mockResolvedValueOnce(true);
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });

    it('returns true if automerge, rebaseWhen=never and stale', async () => {
      config.rebaseWhen = 'never';
      config.automerge = true;
      git.branchExists.mockReturnValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
      expect(git.isBranchStale).not.toHaveBeenCalled();
      expect(git.isBranchModified).not.toHaveBeenCalled();
    });

    it('returns true if automerge, rebaseWhen=conflicted and stale', async () => {
      config.rebaseWhen = 'conflicted';
      config.automerge = true;
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
  });
});
