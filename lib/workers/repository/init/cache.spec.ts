import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepositoryCacheConfig } from '../../../config/types.ts';
import type { WorkerPlatformConfig } from './apis.ts';
import { initializeCaches } from './cache.ts';

describe('workers/repository/init/cache', () => {
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
      GlobalConfig.set({ cacheDir: '' });
    });

    it('initializes', async () => {
      expect(await initializeCaches(config)).toBeUndefined();
    });
  });
});
