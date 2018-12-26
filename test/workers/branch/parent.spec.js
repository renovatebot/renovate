const { getParentBranch } = require('../../../lib/workers/branch/parent');

describe('workers/branch/parent', () => {
  describe('getParentBranch(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        rebaseLabel: 'rebase',
      };
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns undefined if branch does not exist', async () => {
      platform.branchExists.mockReturnValue(false);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns branchName if no PR', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if does not need rebaseing', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isConflicted: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isConflicted: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if PR title rebase!', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        title: 'rebase!Update foo to v4',
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if PR body check rebase', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- renovate-rebase -->foo\n',
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if manual rebase by label', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        canRebase: false,
        labels: ['rebase'],
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isConflicted: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if unmergeable and can rebase (gitlab)', async () => {
      config.isGitLab = true;
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isConflicted: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
      expect(platform.deleteBranch.mock.calls.length).toBe(1);
    });
    it('returns branchName if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockReturnValue(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if automerge branch and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockReturnValue(true);
      platform.isBranchStale.mockReturnValueOnce(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns branch if rebaseStalePrs enabled but cannot rebase', async () => {
      config.rebaseStalePrs = true;
      platform.branchExists.mockReturnValue(true);
      platform.isBranchStale.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValue({
        isConflicted: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).not.toBe(undefined);
    });
  });
});
