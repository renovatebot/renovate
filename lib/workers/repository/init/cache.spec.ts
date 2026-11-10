import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepositoryCacheConfig } from '../../../config/types.ts';
import type { WorkerPlatformConfig } from './apis.ts';
import { initializeCaches } from './cache.ts';

describe('workers/repository/init/cache', () => {
  describe('initializeCaches()', () => {
    let config: WorkerPlatformConfig;
    let tmpDir: DirectoryResult;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });
      config = {
        repository: '',
        repositoryCache: partial<RepositoryCacheConfig>(),
        repositoryCacheType: 'local',
        repoFingerprint: '0123456789abcdef',
        defaultBranch: 'main',
        isFork: false,
      };
      GlobalConfig.set({ cacheDir: tmpDir.path });
    });

    afterEach(async () => {
      await tmpDir.cleanup();
    });

    it('initializes', async () => {
      await expect(initializeCaches(config)).resolves.toBeUndefined();
    });
  });
});
