import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import * as memCache from '../../../../util/cache/memory';
import { toSha256 } from '../../../../util/hash';
import * as _config from './config';
import { rebaseOnboardingBranch } from './rebase';
import { scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

const configModule = vi.mocked(_config);

vi.mock('./config');

describe('workers/repository/onboarding/branch/rebase', () => {
  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;
    const hash = 'hash';
    const onboardingConfigMock = {
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    };

    beforeEach(() => {
      memCache.init();
      GlobalConfig.set({
        localDir: '',
        platform: 'github',
        onboardingBranch: 'renovate/configure',
        onboardingConfigFileName: 'renovate.json',
        onboardingConfig: onboardingConfigMock,
      });

      // using default options
      config = {
        semanticCommits: 'auto',
        semanticCommitScope: 'deps',
        semanticCommitType: 'chore',
        repository: 'some/repo',
      };
      configModule.getOnboardingConfigContents.mockResolvedValue('');
    });

    it('does nothing if branch is up to date', async () => {
      const contents = JSON.stringify(onboardingConfigMock, null, 2) + '\n';
      configModule.getOnboardingConfigContents.mockResolvedValueOnce(contents);
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it('rebases onboarding branch', async () => {
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      GlobalConfig.set({
        localDir: '',
        platform: 'github',
        onboardingBranch: 'renovate/configure',
        onboardingConfigFileName: '.github/renovate.json',
        onboardingConfig: onboardingConfigMock,
      });
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        '.github/renovate.json',
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        '.github/renovate.json',
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      GlobalConfig.set({
        localDir: '',
        platform: 'github',
        onboardingBranch: 'renovate/configure',
        onboardingConfigFileName: undefined,
        onboardingConfig: onboardingConfigMock,
      });
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        'renovate.json',
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        'renovate.json',
      );
    });

    it('handles a missing previous config hash', async () => {
      await rebaseOnboardingBranch(config, undefined);
      expect(scm.commitAndPush).toHaveBeenCalled();
    });

    it('does nothing if config hashes match', async () => {
      const contents = JSON.stringify(onboardingConfigMock, null, 2) + '\n';
      configModule.getOnboardingConfigContents.mockResolvedValueOnce(contents);
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });

    it('dryRun=full', async () => {
      GlobalConfig.set({
        localDir: '',
        dryRun: 'full',
        platform: 'github',
        onboardingBranch: 'renovate/configure',
        onboardingConfigFileName: 'renovate.json',
        onboardingConfig: onboardingConfigMock,
      });
      await rebaseOnboardingBranch(config, hash);

      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would rebase files in onboarding branch',
      );
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });

    // does not rebase on platforms that do not support html comments
    it.each`
      platform
      ${'azure'}
      ${'bitbucket'}
      ${'bitbucket-server'}
      ${'codecommit'}
    `('returns null for $platform', async ({ platform }) => {
      GlobalConfig.set({
        platform,
        localDir: '',
        onboardingBranch: 'renovate/configure',
        onboardingConfigFileName: 'renovate.json',
        onboardingConfig: onboardingConfigMock,
      });
      const res = await rebaseOnboardingBranch(config, hash);
      expect(res).toBeNull();
      expect(scm.commitAndPush).not.toHaveBeenCalled();

      expect(logger.debug).toHaveBeenCalledWith(
        `Skipping rebase as ${platform} does not support html comments`,
      );
    });
  });
});
