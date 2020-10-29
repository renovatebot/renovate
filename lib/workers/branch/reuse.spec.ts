import { git, platform } from '../../../test/util';
import { RenovateConfig } from '../../config';
import { Pr } from '../../platform';
import { PrState } from '../../types';
import { shouldReuseExistingBranch } from './reuse';

jest.mock('../../util/git');

describe('workers/branch/parent', () => {
  describe('getParentBranch(config)', () => {
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
    });
    it('returns undefined if branch does not exist', async () => {
      git.branchExists.mockReturnValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branchName if no PR', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if does not need rebasing', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: false,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if unmergeable and can rebase, but rebaseWhen is never', async () => {
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
    it('returns undefined if PR title rebase!', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'rebase!Update foo to v4',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns undefined if PR body check rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- rebase-check -->foo\n',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('aaa2 returns undefined if manual rebase by label', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        labels: ['rebase'],
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('aaa1 returns undefined if unmergeable and can rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
      });
      git.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branchName if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns undefined if automerge branch and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branch if rebaseWhen=behind-base-branch but cannot rebase', async () => {
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
  });
});
