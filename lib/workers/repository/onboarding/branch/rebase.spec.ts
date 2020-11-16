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
        repository: 'some/repo',
      };
    });
    it('does not rebase modified branch', async () => {
      git.isBranchModified.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(defaultConfig.onboardingConfig, null, 2) + '\n';
      git.getFile
        .mockResolvedValueOnce(contents) // package.json
        .mockResolvedValueOnce(contents); // renovate.json
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('rebases onboarding branch', async () => {
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
    });
  });
});
