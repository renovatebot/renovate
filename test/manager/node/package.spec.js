const node = require('../../../lib/manager/node/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('lib/workers/package/node', () => {
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if no supportPolicy array', async () => {
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if matching', async () => {
      config.currentVersions = ['6', '8'];
      config.supportPolicy = ['lts_active'];
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns result if needing updates', async () => {
      config.currentVersions = ['6', '8'];
      config.supportPolicy = ['lts'];
      expect(await node.getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
