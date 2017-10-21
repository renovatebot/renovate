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
        api: {
          branchExists: jest.fn(() => true),
          deleteBranch: jest.fn(),
          getBranchPr: jest.fn(),
          getBranchStatus: jest.fn(),
          isBranchStale: jest.fn(() => false),
        },
        branchName: 'renovate/some-branch',
        logger,
      };
    });
    it('returns undefined if branch does not exist', async () => {
      config.api.branchExists.mockReturnValue(false);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns branchName if no PR', async () => {
      config.api.getBranchPr.mockReturnValue(null);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if does not need rebaseing', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns undefined if unmergeable and can rebase (gitlab)', async () => {
      config.isGitLab = true;
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
      expect(config.api.deleteBranch.mock.calls.length).toBe(1);
    });
    it('returns branchName if automerge branch-push and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if automerge branch-push and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      config.api.isBranchStale.mockReturnValueOnce(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(undefined);
    });
    it('returns branch if rebaseStalePrs enabled but cannot rebase', async () => {
      config.rebaseStalePrs = true;
      config.api.isBranchStale.mockReturnValueOnce(true);
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).not.toBe(undefined);
    });
  });
});
