import { partial, platform } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { Pr, PrDebugData } from '../../../../modules/platform/index.ts';
import type { BranchConfig } from '../../../types.ts';
import {
  prAlreadyExisted,
  rebaseCheck,
  userChangedTargetBranch,
} from './check-existing.ts';

describe('workers/repository/update/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        upgrades: [],
        branchName: 'some-branch',
        prTitle: 'some-title',
      } satisfies BranchConfig;
    });

    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      await expect(prAlreadyExisted(config)).resolves.toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(0);
    });

    it('returns false if check misses', async () => {
      config.recreateClosed = false;
      await expect(prAlreadyExisted(config)).resolves.toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });

    it('returns true if first check hits', async () => {
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ number: 12 }));
      platform.getPr.mockResolvedValueOnce(
        partial<Pr>({
          number: 12,
          state: 'closed',
        }),
      );
      await expect(prAlreadyExisted(config)).resolves.toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });

    it('returns true if second check hits', async () => {
      config.branchPrefixOld = 'deps/';
      platform.findPr.mockResolvedValueOnce(null);
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ number: 12 }));
      platform.getPr.mockResolvedValueOnce(
        partial<Pr>({
          number: 12,
          state: 'closed',
        }),
      );
      await expect(prAlreadyExisted(config)).resolves.toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(2);

      expect(logger.debug).toHaveBeenCalledWith(
        `Found closed PR with current title`,
      );
    });
  });

  describe('rebaseCheck', () => {
    const config: RenovateConfig = { rebaseLabel: 'rebase' };

    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns true if requested via PR title', async () => {
      const pr = partial<Pr>({ number: 12, title: 'rebase!some title' });
      await expect(rebaseCheck(config, pr)).resolves.toBeTrue();
      expect(platform.deleteLabel).not.toHaveBeenCalled();
    });

    it('returns true and removes the label if requested via PR label', async () => {
      const pr = partial<Pr>({ number: 12, labels: ['rebase'] });
      await expect(rebaseCheck(config, pr)).resolves.toBeTrue();
      expect(platform.deleteLabel).toHaveBeenCalledWith(12, 'rebase');
    });

    it('keeps the label during a dry run', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      const pr = partial<Pr>({ number: 12, labels: ['rebase'] });
      await expect(rebaseCheck(config, pr)).resolves.toBeTrue();
      expect(platform.deleteLabel).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would delete label rebase from #12',
      );
    });

    it('returns true if requested via PR checkbox', async () => {
      const pr = partial<Pr>({
        number: 12,
        bodyStruct: { hash: 'abc', rebaseRequested: true },
      });
      await expect(rebaseCheck(config, pr)).resolves.toBeTrue();
    });

    it('returns false if not requested', async () => {
      const pr = partial<Pr>({ number: 12, title: 'some title', labels: [] });
      await expect(rebaseCheck(config, pr)).resolves.toBeFalse();
    });
  });

  describe('userChangedTargetBranch', () => {
    it('returns false if the old target branch is unknown', () => {
      const pr = partial<Pr>({ targetBranch: 'main' });
      expect(userChangedTargetBranch(pr)).toBeFalse();
    });

    it('returns false if the target branch is unchanged', () => {
      const pr = partial<Pr>({
        targetBranch: 'main',
        bodyStruct: {
          hash: 'abc',
          debugData: partial<PrDebugData>({ targetBranch: 'main' }),
        },
      });
      expect(userChangedTargetBranch(pr)).toBeFalse();
    });

    it('returns true if the target branch was changed', () => {
      const pr = partial<Pr>({
        targetBranch: 'dev',
        bodyStruct: {
          hash: 'abc',
          debugData: partial<PrDebugData>({ targetBranch: 'main' }),
        },
      });
      expect(userChangedTargetBranch(pr)).toBeTrue();
    });
  });
});
