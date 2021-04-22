import { RenovateConfig, getConfig, testName } from '../../../../test/util';
import { initializeCaches } from './cache';

describe(testName(), () => {
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
