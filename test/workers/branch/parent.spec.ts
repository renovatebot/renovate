import { getParentBranch } from '../../../lib/workers/branch/parent';
import { platform } from '../../util';
import { RenovateConfig } from '../../../lib/config';
import { Pr } from '../../../lib/platform';

describe('workers/branch/parent', () => {
  describe('getParentBranch(config)', () => {
    const pr: Pr = { branchName: 'master', state: 'open', title: 'any' };
    let config: RenovateConfig;
    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        rebaseLabel: 'rebase',
        rebaseConflictedPrs: true,
      };
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns undefined if branch does not exist', async () => {
      platform.branchExists.mockResolvedValueOnce(false);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns branchName if no PR', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if does not need rebaseing', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns branchName if unmergeable and can rebase, but rebaseConflictedPrs is disabled', async () => {
      config.rebaseConflictedPrs = false;
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if PR title rebase!', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'rebase!Update foo to v4',
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns undefined if PR body check rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- rebase-check -->foo\n',
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns undefined if manual rebase by label', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isModified: true,
        labels: ['rebase'],
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: false,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns branchName if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockResolvedValueOnce(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBe(config.branchName);
    });
    it('returns undefined if automerge branch and stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.branchExists.mockResolvedValueOnce(true);
      platform.isBranchStale.mockResolvedValueOnce(true);
      const res = await getParentBranch(config);
      expect(res.parentBranch).toBeUndefined();
    });
    it('returns branch if rebaseStalePrs enabled but cannot rebase', async () => {
      config.rebaseStalePrs = true;
      platform.branchExists.mockResolvedValueOnce(true);
      platform.isBranchStale.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        isConflicted: true,
        isModified: true,
      });
      const res = await getParentBranch(config);
      expect(res.parentBranch).not.toBeUndefined();
    });
  });
});
