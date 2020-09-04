import { RenovateConfig, defaultConfig, git } from '../../../../../test/util';
import { rebaseOnboardingBranch } from './rebase';

jest.mock('../../../../util/git');

describe('workers/repository/onboarding/branch/rebase', () => {
  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        semanticCommits: false,
      };
    });
    it('does not rebase modified branch', async () => {
      git.isBranchModified.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('does nothing if branch is up to date', async () => {
      const onboardingConfig = {
        ...defaultConfig.onboardingConfig,
        semanticCommits: config.semanticCommits,
      };
      const contents = JSON.stringify(onboardingConfig, null, 2) + '\n';
      git.getFile.mockResolvedValueOnce(contents); // renovate.json
      await rebaseOnboardingBranch(config);
      expect(git.getFile).toHaveBeenCalledTimes(1);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('rebases onboarding branch', async () => {
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
    });
  });
});
