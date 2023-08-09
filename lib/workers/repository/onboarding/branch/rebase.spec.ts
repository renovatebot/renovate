import { RenovateConfig, scm } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import * as memCache from '../../../../util/cache/memory';
import { toSha256 } from '../../../../util/hash';
import { rebaseOnboardingBranch } from './rebase';
import * as _config from './config';

const configModule: any = _config;

jest.mock('./config');

describe('workers/repository/onboarding/branch/rebase', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
      platform: 'github',
    });
  });

  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;
    const hash = 'hash';

    beforeEach(() => {
      memCache.init();
      config = {
        ...getConfig(),
        repository: 'some/repo',
      };
    });

    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
      configModule.getOnboardingConfigContents.mockResolvedValueOnce(contents);
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it('rebases onboarding branch', async () => {
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(
        {
          ...config,
          onboardingConfigFileName: '.github/renovate.json',
        },
        hash
      );
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        '.github/renovate.json'
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        '.github/renovate.json'
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(
        {
          ...config,
          onboardingConfigFileName: undefined,
        },
        hash
      );
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        'renovate.json'
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        'renovate.json'
      );
    });

    it('handles a missing previous config hash', async () => {
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(config, undefined);
      expect(scm.commitAndPush).toHaveBeenCalled();
    });

    it('does nothing if config hashes match', async () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
      configModule.getOnboardingConfigContents.mockResolvedValueOnce(contents);
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });

    it('requests update if config hashes mismatch', async () => {
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalled();
    });

    it('dryRun=full', async () => {
      GlobalConfig.set({ localDir: '', dryRun: 'full', platform: 'github' });
      configModule.getOnboardingConfigContents.mockResolvedValueOnce('');
      await rebaseOnboardingBranch(config, hash);
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would rebase files in onboarding branch'
      );
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });

    it('does not rebase on platforms that do not support html comments', async () => {
      GlobalConfig.set({ platform: 'azure', localDir: '' });
      const res = await rebaseOnboardingBranch(config, hash);
      expect(res).toBeNull();
      expect(scm.commitAndPush).not.toHaveBeenCalled();
    });
  });
});
