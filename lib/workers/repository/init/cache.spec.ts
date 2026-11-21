import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { GlobalConfig } from '../../../config/global.ts';
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
