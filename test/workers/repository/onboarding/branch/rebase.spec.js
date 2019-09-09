const defaultConfig = require('../../../../../lib/config/defaults').getConfig();
const {
  rebaseOnboardingBranch,
} = require('../../../../../lib/workers/repository/onboarding/branch/rebase');

/** @type any */
const platform = global.platform;

describe('workers/repository/onboarding/branch/rebase', () => {
  describe('rebaseOnboardingBranch()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('does not rebase modified branch', async () => {
      platform.getBranchPr.mockReturnValueOnce({
        isModified: true,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(defaultConfig.onboardingConfig, null, 2) + '\n';
      platform.getFile.mockReturnValueOnce(contents); // package.json
      platform.getFile.mockReturnValueOnce(contents); // renovate.json
      platform.getBranchPr.mockReturnValueOnce({
        isModified: false,
        isStale: false,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('rebases onboarding branch', async () => {
      platform.getBranchPr.mockReturnValueOnce({
        isStale: true,
        isModified: false,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(1);
    });
  });
});
