import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { OnboardingState, toSha256 } from '../common';
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
    const hash = '';

    beforeEach(() => {
      jest.resetAllMocks();
      OnboardingState.prUpdateRequested = false;
      config = {
        ...getConfig(),
        repository: 'some/repo',
      };
    });

    it('does not rebase modified branch', async () => {
      git.isBranchModified.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config, hash);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
      git.getFile
        .mockResolvedValueOnce(contents) // package.json
        .mockResolvedValueOnce(contents); // renovate.json
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
      expect(OnboardingState.prUpdateRequested).toBeFalse();
    });

    it('rebases onboarding branch', async () => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config, hash);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(OnboardingState.prUpdateRequested).toBeTrue();
    });

    it('rebases via platform', async () => {
      platform.commitFiles = jest.fn();
      config.platformCommit = true;
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      await rebaseOnboardingBranch(config, hash);
      expect(platform.commitFiles).toHaveBeenCalledTimes(1);
      expect(OnboardingState.prUpdateRequested).toBeTrue();
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
      expect(OnboardingState.prUpdateRequested).toBeTrue();
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
      expect(OnboardingState.prUpdateRequested).toBeTrue();
    });

    describe('handle onboarding config hashes', () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';

      beforeEach(() => {
        git.isBranchModified.mockResolvedValueOnce(true);
        git.getFile.mockResolvedValueOnce(contents);
      });

      it('handles a missing previous config hash', async () => {
        await rebaseOnboardingBranch(config, undefined);

        expect(OnboardingState.prUpdateRequested).toBeTrue();
      });

      it('does nothing if config hashes match', async () => {
        git.getFile.mockResolvedValueOnce(contents); // package.json
        await rebaseOnboardingBranch(config, toSha256(contents));
        expect(git.commitFiles).toHaveBeenCalledTimes(0);
        expect(OnboardingState.prUpdateRequested).toBeFalse();
      });

      it('requests update if config hashes mismatch', async () => {
        git.getFile.mockResolvedValueOnce(contents); // package.json
        await rebaseOnboardingBranch(config, hash);
        expect(git.commitFiles).toHaveBeenCalledTimes(0);
        expect(OnboardingState.prUpdateRequested).toBeTrue();
      });
    });
  });
});
