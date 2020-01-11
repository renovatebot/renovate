import { RenovateConfig, defaultConfig } from '../../../../util';
import { BranchConfig } from '../../../../../lib/workers/common';

const {
  ensureOnboardingPr,
} = require('../../../../../lib/workers/repository/onboarding/pr');

/** @type any */
const { platform } = require('../../../../../lib/platform');

describe('workers/repository/onboarding/pr', () => {
  describe('ensureOnboardingPr()', () => {
    let config: RenovateConfig;
    let packageFiles;
    let branches: BranchConfig[];
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        errors: [],
        warnings: [],
        description: [],
      };
      packageFiles = { npm: [{ packageFile: 'package.json' }] };
      branches = [];
      platform.getPrBody = jest.fn(input => input);
      platform.createPr.mockReturnValue({});
    });
    let createPrBody: string;
    it('returns if onboarded', async () => {
      config.repoIsOnboarded = true;
      await ensureOnboardingPr(config, packageFiles, branches);
    });
    it('creates PR', async () => {
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });
    it('returns if PR does not need updating', async () => {
      platform.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
        isModified: false,
      });
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });
    it('updates PR', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
        isConflicted: true,
        isModified: true,
      });
      await ensureOnboardingPr(config, {}, branches);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
    });
    it('updates PR', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
        isModified: true,
      });
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
