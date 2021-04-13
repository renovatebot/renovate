import {
  RenovateConfig,
  defaultConfig,
  getName,
  git,
  partial,
  platform,
} from '../../../../../test/util';
import { setAdminConfig } from '../../../../config/admin';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../manager/types';
import { Pr } from '../../../../platform';
import type { BranchConfig } from '../../../types';
import { ensureOnboardingPr } from '.';

jest.mock('../../../../util/git');

describe(getName(__filename), () => {
  describe('ensureOnboardingPr()', () => {
    let config: RenovateConfig;
    let packageFiles: Record<string, PackageFile[]>;
    let branches: BranchConfig[];
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        errors: [],
        warnings: [],
        description: [],
      };
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      branches = [];
      platform.massageMarkdown = jest.fn((input) => input);
      platform.createPr.mockResolvedValueOnce(partial<Pr>({}));
      setAdminConfig();
    });
    let createPrBody: string;
    it('returns if onboarded', async () => {
      config.repoIsOnboarded = true;
      await expect(
        ensureOnboardingPr(config, packageFiles, branches)
      ).resolves.not.toThrow();
    });
    it('creates PR', async () => {
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });
    it('returns if PR does not need updating', async () => {
      platform.getBranchPr.mockResolvedValue(
        partial<Pr>({
          title: 'Configure Renovate',
          body: createPrBody,
        })
      );
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('updates PR when conflicted', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          body: createPrBody,
          isConflicted: true,
        })
      );
      git.isBranchModified.mockResolvedValueOnce(true);
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('updates PR when modified', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          body: createPrBody,
        })
      );
      git.isBranchModified.mockResolvedValueOnce(true);
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('creates PR (no require config)', async () => {
      config.requireConfig = false;
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });
    it('dryrun of updates PR when modified', async () => {
      setAdminConfig({ dryRun: true });
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Configure Renovate',
          body: createPrBody,
          isConflicted: true,
        })
      );
      git.isBranchModified.mockResolvedValueOnce(true);
      await ensureOnboardingPr(config, {}, branches);
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure'
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would update onboarding PR'
      );
    });
    it('dryrun of creates PR', async () => {
      setAdminConfig({ dryRun: true });
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure'
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would create onboarding PR'
      );
    });
  });
});
