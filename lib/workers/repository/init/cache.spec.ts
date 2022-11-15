import { getConfig } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { WorkerPlatformConfig } from './apis';
import { initializeCaches } from './cache';

describe('workers/repository/init/cache', () => {
  describe('initializeCaches()', () => {
    let config: WorkerPlatformConfig;

    beforeEach(() => {
      config = {
        ...getConfig(),
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
