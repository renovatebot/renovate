import { RenovateConfig, getConfig, getName } from '../../../../test/util';
import { setGlobalConfig } from '../../../config/admin';
import { initializeCaches } from './cache';

describe(getName(), () => {
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
