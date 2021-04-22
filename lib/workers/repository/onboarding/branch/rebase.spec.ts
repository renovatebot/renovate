import {
  RenovateConfig,
  defaultConfig,
  getName,
  git,
} from '../../../../../test/util';
import { rebaseOnboardingBranch } from './rebase';

jest.mock('../../../../util/git');

describe(getName(__filename), () => {
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
    it('uses the onboardingConfigFileName if set', async () => {
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls[0][0].message).toContain(
        '.github/renovate.json'
      );
      expect(git.commitFiles.mock.calls[0][0].files[0].name).toBe(
        '.github/renovate.json'
      );
    });
    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      git.isBranchStale.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: undefined,
      });
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls[0][0].message).toContain(
        'renovate.json'
      );
      expect(git.commitFiles.mock.calls[0][0].files[0].name).toBe(
        'renovate.json'
      );
    });
  });
});
