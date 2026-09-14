import type { RenovateConfig } from '~test/util.ts';
import { getJsonFile, platform } from '~test/util.ts';
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
      delete config.optimizeForDisabled;
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
      getJsonFile.mockResolvedValueOnce({ enabled: false });
      await expect(
        initApis({
          ...config,
          optimizeForDisabled: true,
        }),
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });

    it('throws for forked', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce({
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
      getJsonFile.mockResolvedValueOnce({
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
      getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'enabled',
      });
      const workerPlatformConfig = await initApis(config);
      expect(workerPlatformConfig).toBeTruthy();
    });

    it('ignores getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockRejectedValue(new Error());
      await expect(
        initApis({
          ...config,
          optimizeForDisabled: true,
          forkProcessing: 'disabled',
          isFork: true,
        }),
      ).resolves.not.toThrow();
    });

    it('throws for fork with getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
        repoFingerprint: '123',
      });
      getJsonFile.mockRejectedValue(new Error());
      await expect(
        initApis({
          ...config,
          forkProcessing: 'disabled',
        }),
      ).rejects.toThrow(REPOSITORY_FORKED);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      GlobalConfig.set({ onboardingConfigFileName: '.github/renovate.json' });
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'disabled',
      });
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe(
        '.github/renovate.json',
      );
      expect(getJsonFile).toHaveBeenCalledExactlyOnceWith(
        '.github/renovate.json',
      );
      expect(getJsonFile).not.toHaveBeenCalledExactlyOnceWith('renovate.json');
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce({
        forkProcessing: 'disabled',
      });
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        onboardingConfigFileName: undefined,
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBeUndefined();
      expect(getJsonFile).toHaveBeenCalledExactlyOnceWith('renovate.json');
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not valid', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce({ forkProcessing: false });
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        onboardingConfigFileName: 'foo.bar',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe('foo.bar');
      expect(getJsonFile).toHaveBeenCalledExactlyOnceWith('renovate.json');
    });

    it('checks for re-enablement and continues', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce({
        enabled: true,
      });
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        extends: [':disableRenovate'],
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(getJsonFile).toHaveBeenCalledExactlyOnceWith('renovate.json');
    });

    it('checks for re-enablement and skips', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      getJsonFile.mockResolvedValueOnce(null);
      await expect(
        initApis({
          ...config,
          optimizeForDisabled: true,
          extends: [':disableRenovate'],
        }),
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
  });
});
