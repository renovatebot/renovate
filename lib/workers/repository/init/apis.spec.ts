import type { RenovateConfig } from '~test/util.ts';
import { platform } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages.ts';
import { initApis } from './apis.ts';

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.reset();
      config = { ...getConfig() };
      config.errors = [];
      config.warnings = [];
      delete config.forkProcessing;
    });

    it('runs', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      const workerPlatformConfig = await initApis(config);
      expect(workerPlatformConfig).toBeTruthy();
    });

    it('throws for disabled', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({ enabled: false });
      GlobalConfig.set({ optimizeForDisabled: true });
      await expect(initApis(config)).rejects.toThrow(REPOSITORY_DISABLED);
    });

    it('throws for forked', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'disabled',
      });
      await expect(
        initApis({
          ...config,
          forkProcessing: 'disabled',
        }),
      ).rejects.toThrow(REPOSITORY_FORKED);
    });

    it('does not throw for includeForks=true', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        includeForks: true,
      });
      const workerPlatformConfig = await initApis(config);
      expect(workerPlatformConfig).toBeTruthy();
    });

    it('does not throw for forkProcessing=enabled', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'enabled',
      });
      const workerPlatformConfig = await initApis(config);
      expect(workerPlatformConfig).toBeTruthy();
    });

    it('ignores platform.getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockRejectedValue(new Error());
      GlobalConfig.set({ optimizeForDisabled: true });
      await expect(
        initApis({
          ...config,
          forkProcessing: 'disabled',
          isFork: true,
        }),
      ).resolves.not.toThrow();
    });

    it('throws for fork with platform.getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockRejectedValue(new Error());
      await expect(
        initApis({
          ...config,
          forkProcessing: 'disabled',
        }),
      ).rejects.toThrow(REPOSITORY_FORKED);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      GlobalConfig.set({
        onboardingConfigFileName: '.github/renovate.json',
        optimizeForDisabled: true,
      });
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'disabled',
      });
      const workerPlatformConfig = await initApis({
        ...config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe(
        '.github/renovate.json',
      );
      expect(platform.getJsonFile).toHaveBeenCalledExactlyOnceWith(
        '.github/renovate.json',
      );
      expect(platform.getJsonFile).not.toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'disabled',
      });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
        onboardingConfigFileName: undefined,
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBeUndefined();
      expect(platform.getJsonFile).toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not valid', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({ forkProcessing: false });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
        onboardingConfigFileName: 'foo.bar',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe('foo.bar');
      expect(platform.getJsonFile).toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
      );
    });

    it('checks for re-enablement and continues', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({
        enabled: true,
      });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
        extends: [':disableRenovate'],
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(platform.getJsonFile).toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
      );
    });

    it('checks for re-enablement and skips', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce(null);
      GlobalConfig.set({ optimizeForDisabled: true });
      await expect(
        initApis({
          ...config,
          extends: [':disableRenovate'],
        }),
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
  });
});
