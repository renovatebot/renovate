import { RenovateConfig, platform } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages';
import { initApis } from './apis';

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = { ...getConfig() };
      config.errors = [];
      config.warnings = [];
      config.token = 'some-token';
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
      platform.getJsonFile.mockResolvedValueOnce({ enabled: false });
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

    it('ignores platform.getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockRejectedValue(new Error());
      await expect(
        initApis({
          ...config,
          optimizeForDisabled: true,
          forkProcessing: 'disabled',
          isFork: true,
        }),
      ).resolves.not.toThrow();
    });

    it('uses the onboardingConfigFileName if set', async () => {
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
        optimizeForDisabled: true,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe(
        '.github/renovate.json',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.github/renovate.json',
      );
      expect(platform.getJsonFile).not.toHaveBeenCalledWith('renovate.json');
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
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        onboardingConfigFileName: undefined,
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBeUndefined();
      expect(platform.getJsonFile).toHaveBeenCalledWith('renovate.json');
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not valid', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce({ forkProcessing: false });
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        onboardingConfigFileName: 'foo.bar',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe('foo.bar');
      expect(platform.getJsonFile).toHaveBeenCalledWith('renovate.json');
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
      const workerPlatformConfig = await initApis({
        ...config,
        optimizeForDisabled: true,
        extends: [':disableRenovate'],
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(platform.getJsonFile).toHaveBeenCalledWith('renovate.json');
    });

    it('checks for re-enablement and skips', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: '123',
      });
      platform.getJsonFile.mockResolvedValueOnce(null);
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
