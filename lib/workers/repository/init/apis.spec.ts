import { RenovateConfig, getConfig, platform } from '../../../../test/util';
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
      delete config.includeForks;
    });
    it('runs', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      const workerPlatformConfig = await initApis(config);
      expect(workerPlatformConfig).toBeTruthy();
    });
    it('throws for disabled', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ enabled: false });
      await expect(
        initApis({
          ...config,
          optimizeForDisabled: true,
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
    it('throws for forked', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: true,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      await expect(
        initApis({
          ...config,
          includeForks: false,
        })
      ).rejects.toThrow(REPOSITORY_FORKED);
    });
    it('uses the onboardingConfigFileName if set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      const workerPlatformConfig = await initApis({
        config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe(
        '.github/renovate.json'
      );
    });
    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      const workerPlatformConfig = await initApis({
        config,
        onboardingConfigFileName: undefined,
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBeUndefined();
    });
    it('falls back to "renovate.json" if onboardingConfigFileName is not valid', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      const workerPlatformConfig = await initApis({
        config,
        onboardingConfigFileName: 'foo.bar',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBeUndefined();
    });
  });
});
