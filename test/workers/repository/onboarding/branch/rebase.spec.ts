import { mock } from 'jest-mock-extended';
import { RenovateConfig, defaultConfig, platform } from '../../../../util';
import { rebaseOnboardingBranch } from '../../../../../lib/workers/repository/onboarding/branch/rebase';
import { Pr } from '../../../../../lib/platform';

describe('workers/repository/onboarding/branch/rebase', () => {
  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('does not rebase modified branch', async () => {
      platform.getBranchPr.mockResolvedValueOnce({
        ...mock<Pr>(),
        isModified: true,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(defaultConfig.onboardingConfig, null, 2) + '\n';
      platform.getFile
        .mockResolvedValueOnce(contents) // package.json
        .mockResolvedValueOnce(contents); // renovate.json
      platform.getBranchPr.mockResolvedValueOnce({
        ...mock<Pr>(),
        isModified: false,
        isStale: false,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('rebases onboarding branch', async () => {
      platform.getBranchPr.mockResolvedValueOnce({
        ...mock<Pr>(),
        isStale: true,
        isModified: false,
      });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(1);
    });
  });
});
