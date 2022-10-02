import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { rebaseOnboardingBranch } from './rebase';

jest.mock('../../../../util/git');

describe('workers/repository/onboarding/branch/rebase', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...getConfig(),
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
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
      git.getFile
        .mockResolvedValueOnce(contents) // package.json
        .mockResolvedValueOnce(contents); // renovate.json
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('rebases onboarding branch', async () => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
    });

    it('rebases via platform', async () => {
      platform.commitFiles = jest.fn();
      config.platformCommit = true;
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config);
      expect(platform.commitFiles).toHaveBeenCalledTimes(1);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls[0][0].message).toContain(
        '.github/renovate.json'
      );
      expect(git.commitFiles.mock.calls[0][0].files[0].path).toBe(
        '.github/renovate.json'
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: undefined,
      });
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls[0][0].message).toContain(
        'renovate.json'
      );
      expect(git.commitFiles.mock.calls[0][0].files[0].path).toBe(
        'renovate.json'
      );
    });
  });
});
