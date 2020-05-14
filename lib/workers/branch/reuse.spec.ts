import { platform } from '../../../test/util';
import { RenovateConfig } from '../../config';
import { PR_STATE_OPEN } from '../../constants/pull-requests';
import { Pr } from '../../platform';
import { shouldReuseExistingBranch } from './reuse';

describe('workers/branch/parent', () => {
  describe('getParentBranch(config)', () => {
    const pr: Pr = {
      branchName: 'master',
      state: PR_STATE_OPEN,
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
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns undefined if branch does not exist', async () => {
      platform.branchExists.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branchName if no PR', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if does not need rebaseing', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: false,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: true,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns branchName if unmergeable and can rebase, but rebaseWhen is never', async () => {
      config.rebaseWhen = 'never';
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: false,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns undefined if PR title rebase!', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'rebase!Update foo to v4',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns undefined if PR body check rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- rebase-check -->foo\n',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns undefined if manual rebase by label', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isModified: true,
        labels: ['rebase'],
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: false,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branchName if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });
    it('returns undefined if automerge branch and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockResolvedValueOnce(true);
      platform.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });
    it('returns branch if rebaseWhen=behind-base-branch but cannot rebase', async () => {
      config.rebaseWhen = 'behind-base-branch';
      platform.branchExists.mockResolvedValueOnce(true);
      platform.isBranchStale.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: true,
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).not.toBeUndefined();
    });
  });
});
