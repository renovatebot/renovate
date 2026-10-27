import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepositoryCacheConfig } from '../../../config/types.ts';
import * as nugetApi from '../../../modules/datasource/nuget/index.ts';
import type { WorkerPlatformConfig } from './apis.ts';
import { initializeCaches, resetCaches } from './cache.ts';

describe('workers/repository/init/cache', () => {
  beforeEach(() => {
    GlobalConfig.set({ cacheDir: '' });
  });

  describe('resetCaches()', () => {
    it('resets caches', async () => {
      await expect(resetCaches()).resolves.toBeUndefined();
    });
  });

  describe('initializeCaches()', () => {
    let config: WorkerPlatformConfig;

    beforeEach(() => {
      config = {
        repository: '',
        repositoryCache: partial<RepositoryCacheConfig>(),
        repositoryCacheType: 'local',
        repoFingerprint: '0123456789abcdef',
        defaultBranch: 'main',
        isFork: false,
      };
    });

    it('initializes', async () => {
      await expect(initializeCaches(config)).resolves.toBeUndefined();
    });

    it('initializes with nugetConfig', async () => {
      const spy = vi.spyOn(nugetApi, 'setNugetConfig');
      config.nugetConfig = '<configuration />';
      await expect(initializeCaches(config)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith();
      expect(spy).toHaveBeenCalledWith('<configuration />');
    });
  });
});
