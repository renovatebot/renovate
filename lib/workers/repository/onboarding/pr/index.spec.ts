import {
  RenovateConfig,
  defaultConfig,
  partial,
  platform,
} from '../../../../../test/util';
import { PackageFile } from '../../../../manager/common';
import { Pr } from '../../../../platform';
import { BranchConfig } from '../../../common';
import { ensureOnboardingPr } from '.';

describe('workers/repository/onboarding/pr', () => {
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
      platform.getPrBody = jest.fn((input) => input);
      platform.createPr.mockResolvedValueOnce(partial<Pr>({}));
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
          isModified: false,
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
          isModified: true,
        })
      );
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
          isModified: true,
        })
      );
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('creates PR (no require config)', async () => {
      config.requireConfig = false;
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
    });
  });
});
