import { RenovateConfig, getConfig, platform } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
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
      GlobalConfig.reset();
      delete config.includeForks;
    });
    afterEach(() => {
      jest.resetAllMocks();
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
      GlobalConfig.set({ optimizeForDisabled: true });
      await expect(initApis({ ...config })).rejects.toThrow(
        REPOSITORY_DISABLED
      );
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
    it('ignores platform.getJsonFile() failures', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockRejectedValue(new Error());
      GlobalConfig.set({ optimizeForDisabled: true });
      await expect(
        initApis({
          ...config,
          includeForks: false,
          isFork: true,
        })
      ).resolves.not.toThrow();
    });
    it('uses the onboardingConfigFileName if set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe(
        '.github/renovate.json'
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.github/renovate.json'
      );
      expect(platform.getJsonFile).not.toHaveBeenCalledWith('renovate.json');
    });
    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      platform.initRepo.mockResolvedValueOnce({
        defaultBranch: 'master',
        isFork: false,
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
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
      });
      platform.getJsonFile.mockResolvedValueOnce({ includeForks: false });
      GlobalConfig.set({ optimizeForDisabled: true });
      const workerPlatformConfig = await initApis({
        ...config,
        onboardingConfigFileName: 'foo.bar',
      });
      expect(workerPlatformConfig).toBeTruthy();
      expect(workerPlatformConfig.onboardingConfigFileName).toBe('foo.bar');
      expect(platform.getJsonFile).toHaveBeenCalledWith('renovate.json');
    });
  });
});
