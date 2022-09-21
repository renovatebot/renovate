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

    it.each`
      checkboxEnabled
      ${true}
      ${false}
    `(
      'does nothing if branch is up to date ' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled }) => {
        config.onboardingRebaseCheckbox = checkboxEnabled;
        const contents =
          JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
        git.getFile
          .mockResolvedValueOnce(contents) // package.json
          .mockResolvedValueOnce(contents); // renovate.json
        await rebaseOnboardingBranch(config, toSha256(contents));
        expect(git.commitFiles).toHaveBeenCalledTimes(0);
        expect(OnboardingState.prUpdateRequested).toBeFalse();
      }
    );

    it.each`
      checkboxEnabled | expected
      ${true}         | ${true}
      ${false}        | ${false}
    `(
      'rebases onboarding branch ' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled, expected }) => {
        config.onboardingRebaseCheckbox = checkboxEnabled;
        git.isBranchBehindBase.mockResolvedValueOnce(true);
        await rebaseOnboardingBranch(config, hash);
        expect(git.commitFiles).toHaveBeenCalledTimes(1);
        expect(OnboardingState.prUpdateRequested).toBe(expected);
      }
    );

    it.each`
      checkboxEnabled | expected
      ${true}         | ${true}
      ${false}        | ${false}
    `(
      'rebases via platform ' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled, expected }) => {
        platform.commitFiles = jest.fn();
        config.platformCommit = true;
        config.onboardingRebaseCheckbox = checkboxEnabled;
        git.isBranchBehindBase.mockResolvedValueOnce(true);
        await rebaseOnboardingBranch(config, hash);
        expect(platform.commitFiles).toHaveBeenCalledTimes(1);
        expect(OnboardingState.prUpdateRequested).toBe(expected);
      }
    );

    it.each`
      checkboxEnabled | expected
      ${true}         | ${true}
      ${false}        | ${false}
    `(
      'uses the onboardingConfigFileName if set ' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled, expected }) => {
        git.isBranchBehindBase.mockResolvedValueOnce(true);
        await rebaseOnboardingBranch({
          ...config,
          onboardingConfigFileName: '.github/renovate.json',
          onboardingRebaseCheckbox: checkboxEnabled,
        });
        expect(git.commitFiles).toHaveBeenCalledTimes(1);
        expect(git.commitFiles.mock.calls[0][0].message).toContain(
          '.github/renovate.json'
        );
        expect(git.commitFiles.mock.calls[0][0].files[0].path).toBe(
          '.github/renovate.json'
        );
        expect(OnboardingState.prUpdateRequested).toBe(expected);
      }
    );

    it.each`
      checkboxEnabled | expected
      ${true}         | ${true}
      ${false}        | ${false}
    `(
      'falls back to "renovate.json" if onboardingConfigFileName is not set ' +
        '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
      async ({ checkboxEnabled, expected }) => {
        git.isBranchBehindBase.mockResolvedValueOnce(true);
        await rebaseOnboardingBranch({
          ...config,
          onboardingConfigFileName: undefined,
          onboardingRebaseCheckbox: checkboxEnabled,
        });
        expect(git.commitFiles).toHaveBeenCalledTimes(1);
        expect(git.commitFiles.mock.calls[0][0].message).toContain(
          'renovate.json'
        );
        expect(git.commitFiles.mock.calls[0][0].files[0].path).toBe(
          'renovate.json'
        );
        expect(OnboardingState.prUpdateRequested).toBe(expected);
      }
    );

    describe('handle onboarding config hashes', () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';

      beforeEach(() => {
        git.isBranchModified.mockResolvedValueOnce(true);
        git.getFile.mockResolvedValueOnce(contents);
      });

      it.each`
        checkboxEnabled | expected
        ${true}         | ${true}
        ${false}        | ${false}
      `(
        'handles a missing previous config hash ' +
          '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
        async ({ checkboxEnabled, expected }) => {
          config.onboardingRebaseCheckbox = checkboxEnabled;
          await rebaseOnboardingBranch(config, undefined);

          expect(OnboardingState.prUpdateRequested).toBe(expected);
        }
      );

      it.each`
        checkboxEnabled
        ${true}
        ${false}
      `(
        'does nothing if config hashes match' +
          '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
        async ({ checkboxEnabled, expected }) => {
          git.getFile.mockResolvedValueOnce(contents); // package.json
          config.onboardingRebaseCheckbox = checkboxEnabled;
          await rebaseOnboardingBranch(config, toSha256(contents));
          expect(git.commitFiles).toHaveBeenCalledTimes(0);
          expect(OnboardingState.prUpdateRequested).toBeFalse();
        }
      );

      it.each`
        checkboxEnabled | expected
        ${true}         | ${true}
        ${false}        | ${false}
      `(
        'requests update if config hashes mismatch' +
          '(config.onboardingRebaseCheckbox="$checkboxEnabled")',
        async ({ checkboxEnabled, expected }) => {
          git.getFile.mockResolvedValueOnce(contents); // package.json
          config.onboardingRebaseCheckbox = checkboxEnabled;
          await rebaseOnboardingBranch(config, hash);
          expect(git.commitFiles).toHaveBeenCalledTimes(0);
          expect(OnboardingState.prUpdateRequested).toBe(expected);
        }
      );
    });
  });
});
