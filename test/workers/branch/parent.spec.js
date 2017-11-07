const {
  checkStale,
  getParentBranch,
} = require('../../../lib/workers/branch/parent');
const logger = require('../../_fixtures/logger');

describe('workers/branch/parent', () => {
  describe('checkStale', () => {
    it('returns true if rebaseStalePrs', () => {
      const config = { rebaseStalePrs: true };
      expect(checkStale(config)).toBe(true);
    });
    it('returns true if repoForceRebase', () => {
      const config = { repoForceRebase: true };
      expect(checkStale(config)).toBe(true);
    });
    it('returns true if repoForceRebase', () => {
      const config = { automerge: true, automergeType: 'branch-push' };
      expect(checkStale(config)).toBe(true);
    });
  });
  describe('getParentBranch(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        logger,
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
        isUnmergeable: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if unmergeable and can rebase (gitlab)', async () => {
      config.isGitLab = true;
      platform.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
      expect(platform.deleteBranch.mock.calls.length).toBe(1);
    });
    it('returns branchName if automerge branch-push and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      platform.branchExists.mockReturnValue(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if automerge branch-push and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
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
        isUnmergeable: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).not.toBe(undefined);
    });
  });
});
