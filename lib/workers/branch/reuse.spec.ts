import { git, platform } from '../../../test/util';
import type { Pr } from '../../modules/platform';
import { PrState } from '../../types';
import type { BranchConfig } from '../types';
import { shouldReuseExistingBranch } from './reuse';

jest.mock('../../util/git');

describe('workers/branch/reuse', () => {
  describe('shouldReuseExistingBranch(config)', () => {
    const pr: Pr = {
      number: 42,
      sourceBranch: 'master',
      state: PrState.Open,
      title: 'any',
    };
    let config: BranchConfig;
    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        rebaseLabel: 'rebase',
        rebaseWhen: 'behind-base-branch',
        upgrades: [],
      };
      jest.resetAllMocks();
    });
    it('returns false if branch does not exist', async () => {
      git.branchExists.mockReturnValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns true if no PR', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValue(null);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });
    it('returns true if does not need rebasing', async () => {
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if does not need rebasing but has upgrades that need lockfile maintenance along with upgrades that do not', async () => {
      config.upgrades = [
        {
          packageFile: 'package.json',
          rangeStrategy: 'replace',
          branchName: 'current',
        },
        {
          packageFile: 'package.json',
          rangeStrategy: 'update-lockfile',
          branchName: 'current',
        },
        {
          packageFile: 'package.json',
          rangeStrategy: 'in-range-only',
          branchName: 'current',
        },
      ];
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });

    it('returns true if does not need rebasing and lockfile update is on different packages', async () => {
      config.upgrades = [
        {
          packageFile: 'package.json',
          rangeStrategy: 'replace',
          branchName: 'current',
        },
        {
          packageFile: 'subpackage/package.json',
          rangeStrategy: 'update-lockfile',
          branchName: 'current',
        },
      ];
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });

    it('returns true if unmergeable and cannot rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });
    it('returns true if unmergeable and can rebase, but rebaseWhen is never', async () => {
      config.rebaseWhen = 'never';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      git.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });
    it('returns false if PR title rebase!', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'rebase!Update foo to v4',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns false if PR body check rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        title: 'Update foo to v4',
        body: 'blah\nblah\n- [x] <!-- rebase-check -->foo\n',
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns false if manual rebase by label', async () => {
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        ...pr,
        labels: ['rebase'],
      });
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns false if unmergeable and can rebase', async () => {
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      git.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns true if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });
    it('returns false if automerge branch and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'branch';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });
    it('returns true if rebaseWhen=behind-base-branch but cannot rebase', async () => {
      config.rebaseWhen = 'behind-base-branch';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      git.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if automerge pr and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'pr';
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns false if getRepoForceRebase and stale', async () => {
      config.rebaseWhen = 'auto';
      platform.getRepoForceRebase.mockResolvedValueOnce(true);
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns true if automerge, rebaseWhen=never and stale', async () => {
      config.rebaseWhen = 'never';
      config.automerge = true;
      git.branchExists.mockReturnValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
      expect(git.isBranchStale).not.toHaveBeenCalled();
      expect(git.isBranchModified).not.toHaveBeenCalled();
    });

    it('returns true if automerge, rebaseWhen=conflicted and stale', async () => {
      config.rebaseWhen = 'conflicted';
      config.automerge = true;
      git.branchExists.mockReturnValueOnce(true);
      git.isBranchStale.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });
  });
});
