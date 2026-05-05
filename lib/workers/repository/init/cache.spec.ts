import { partial } from '~test/util.ts';
import type { RepositoryCache } from '../../../config/allowed-values.generated.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { WorkerPlatformConfig } from './apis.ts';
import { initializeCaches } from './cache.ts';

describe('workers/repository/init/cache', () => {
  describe('initializeCaches()', () => {
    let config: WorkerPlatformConfig;

    beforeEach(() => {
      config = {
        repository: '',
        repositoryCache: partial<RepositoryCache>(),
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
