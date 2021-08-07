import { RenovateConfig, getConfig, getName } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import { initializeCaches } from './cache';

describe(getName(), () => {
  describe('initializeCaches()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = { ...getConfig() };
      setAdminConfig({ cacheDir: '' });
    });
    it('initializes', async () => {
      expect(await initializeCaches(config)).toBeUndefined();
    });
  });
});
