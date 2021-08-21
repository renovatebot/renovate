import { RenovateConfig, getConfig } from '../../../../test/util';
import { setGlobalConfig } from '../../../config/global';
import { initializeCaches } from './cache';

describe('workers/repository/init/cache', () => {
  describe('initializeCaches()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = { ...getConfig() };
      setGlobalConfig({ cacheDir: '' });
    });
    it('initializes', async () => {
      expect(await initializeCaches(config)).toBeUndefined();
    });
  });
});
