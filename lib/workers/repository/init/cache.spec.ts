import { RenovateConfig, getConfig } from '../../../../test/util';
import { initializeCaches } from './cache';

describe('workers/repository/init/cache', () => {
  describe('initializeCaches()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = { ...getConfig() };
    });
    it('initializes', async () => {
      expect(await initializeCaches(config)).toBeUndefined();
    });
  });
});
