import { partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepositoryCacheConfig } from '../../../config/types';
import type { WorkerPlatformConfig } from './apis';
import { initializeCaches } from './cache';

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
