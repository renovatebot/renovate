import type { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';
import { shouldReuseExistingBranch } from './reuse';
import { platform, scm } from '~test/util';

describe('workers/repository/update/branch/reuse', () => {
  describe('shouldReuseExistingBranch(config)', () => {
    const pr: Pr = {
      number: 42,
      sourceBranch: 'master',
      state: 'open',
      title: 'any',
      labels: ['keep-updated'],
    };
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        manager: 'some-manager',
        branchName: 'renovate/some-branch',
        baseBranch: 'base',
        rebaseLabel: 'rebase',
        rebaseWhen: 'behind-base-branch',
        upgrades: [],
      };
    });

    it('returns false if branch does not exist', async () => {
      scm.branchExists.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns true if no PR', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValue(null);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns true if does not need rebasing', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if does not need rebasing but has upgrades that need lockfile maintenance along with upgrades that do not', async () => {
      config.upgrades = [
        {
          manager: 'some-manager',
          packageFile: 'package.json',
          rangeStrategy: 'replace',
          branchName: 'current',
        },
        {
          manager: 'some-manager',
          packageFile: 'package.json',
          rangeStrategy: 'update-lockfile',
          branchName: 'current',
        },
        {
          manager: 'some-manager',
          packageFile: 'package.json',
          rangeStrategy: 'in-range-only',
          branchName: 'current',
        },
      ];
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(false);
    });

    it('returns true if does not need rebasing and lockfile update is on different packages', async () => {
      config.upgrades = [
        {
          manager: 'some-manager',
          packageFile: 'package.json',
          rangeStrategy: 'replace',
          branchName: 'current',
        },
        {
          manager: 'some-manager',
          packageFile: 'subpackage/package.json',
          rangeStrategy: 'update-lockfile',
          branchName: 'current',
        },
      ];
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBe(true);
    });

    it('returns true if unmergeable and cannot rebase', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns true if unmergeable and can rebase, but rebaseWhen is never', async () => {
      config.rebaseWhen = 'never';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if unmergeable and can rebase', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns true if automerge branch and not stale', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if automerge branch and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'branch';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns true if rebaseWhen=behind-base-branch but cannot rebase', async () => {
      config.rebaseWhen = 'behind-base-branch';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if automerge pr and stale', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      config.automergeType = 'pr';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns false if getBranchForceRebase and stale', async () => {
      config.rebaseWhen = 'auto';
      platform.getBranchForceRebase.mockResolvedValueOnce(true);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns true if automerge, rebaseWhen=never and stale', async () => {
      config.rebaseWhen = 'never';
      config.automerge = true;
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
      expect(scm.isBranchBehindBase).not.toHaveBeenCalled();
      expect(scm.isBranchModified).not.toHaveBeenCalled();
    });

    it('returns true if automerge, rebaseWhen=conflicted and stale', async () => {
      config.rebaseWhen = 'conflicted';
      config.automerge = true;
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('returns false if rebaseWhen=never, keepUpdatedLabel and stale', async () => {
      config.rebaseWhen = 'never';
      config.keepUpdatedLabel = 'keep-updated';
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
    });

    it('returns false if rebaseWhen=conflicted, keepUpdatedLabel and modified', async () => {
      config.rebaseWhen = 'never';
      config.keepUpdatedLabel = 'keep-updated';
      platform.getBranchPr.mockResolvedValue(pr);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchConflicted.mockResolvedValueOnce(true);
      scm.isBranchModified.mockResolvedValueOnce(false);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeFalse();
      expect(res.isModified).toBeUndefined();
    });

    it('returns true if rebaseWhen=never, miss-match keepUpdatedLabel and stale', async () => {
      config.rebaseWhen = 'never';
      config.keepUpdatedLabel = 'keep-not-updated';
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      const res = await shouldReuseExistingBranch(config);
      expect(res.reuseExistingBranch).toBeTrue();
    });

    it('converts rebaseWhen=auto to behind-base-branch if automerge', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      const result = await shouldReuseExistingBranch(config);
      expect(config.rebaseWhen).toBe('auto');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });

    it('converts rebaseWhen=auto to behind-base-branch if getBranchForceRebase', async () => {
      config.rebaseWhen = 'auto';
      platform.getBranchForceRebase.mockResolvedValueOnce(true);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      const result = await shouldReuseExistingBranch(config);
      expect(config.rebaseWhen).toBe('auto');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });

    it('converts rebaseWhen=auto to behind-base-branch if keepUpdatedLabel', async () => {
      config.rebaseWhen = 'auto';
      config.keepUpdatedLabel = 'keep-updated';
      platform.getBranchPr.mockResolvedValue(pr);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      const result = await shouldReuseExistingBranch(config);
      expect(config.rebaseWhen).toBe('auto');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });

    it('converts rebaseWhen=auto to conflicted', async () => {
      config.rebaseWhen = 'auto';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      const result = await shouldReuseExistingBranch(config);
      expect(config.rebaseWhen).toBe('auto');
      expect(result.rebaseWhen).toBe('conflicted');
    });

    it('converts rebaseWhen=automerging to behind-base-branch', async () => {
      config.rebaseWhen = 'automerging';
      config.automerge = true;
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);

      const result = await shouldReuseExistingBranch(config);

      expect(config.rebaseWhen).toBe('automerging');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });

    it('converts rebaseWhen=automerging to behind-base-branch if keep-updated', async () => {
      config.rebaseWhen = 'automerging';
      config.keepUpdatedLabel = 'keep-updated';
      config.automerge = false;
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);

      const result = await shouldReuseExistingBranch(config);

      expect(config.rebaseWhen).toBe('automerging');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });

    it('converts rebaseWhen=automerging to never', async () => {
      config.rebaseWhen = 'automerging';
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);

      const result = await shouldReuseExistingBranch(config);

      expect(config.rebaseWhen).toBe('automerging');
      expect(result.rebaseWhen).toBe('never');
    });

    it('converts rebaseWhen=auto to behind-base-branch if automerge is true AND branch is new', async () => {
      config.rebaseWhen = 'auto';
      config.automerge = true;
      scm.branchExists.mockResolvedValueOnce(false);
      scm.isBranchBehindBase.mockResolvedValueOnce(false);
      const result = await shouldReuseExistingBranch(config);
      expect(config.rebaseWhen).toBe('auto');
      expect(result.rebaseWhen).toBe('behind-base-branch');
    });
  });
});
