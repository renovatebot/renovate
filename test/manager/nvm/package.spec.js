const node = require('../../../lib/manager/nvm/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('lib/workers/package/node', () => {
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if matching', async () => {
      config.currentVersion = ['6', '8'];
      config.supportPolicy = ['lts_active'];
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns result if needing updates', async () => {
      config.currentVersion = ['6', '8'];
      expect(await node.getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
