const node = require('../../../lib/manager/travis/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const githubDatasource = require('../../../lib/datasource/github');

jest.mock('../../../lib/datasource/github');

describe('lib/manager/node/package', () => {
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if missing supportPolicy', async () => {
      config.currentVersion = ['6', '8'];
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if invalid supportPolicy', async () => {
      config.currentVersion = ['6', '8'];
      config.supportPolicy = ['foo'];
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if matching', async () => {
      config.currentVersion = ['8'];
      config.supportPolicy = ['lts_active'];
      expect(await node.getPackageUpdates(config)).toEqual([]);
    });
    it('returns result if needing updates', async () => {
      config.currentVersion = ['6', '8'];
      config.supportPolicy = ['lts'];
      expect(await node.getPackageUpdates(config)).toMatchSnapshot();
    });
    it('detects pinning', async () => {
      config.currentVersion = ['6.1.0', '8.4.0'];
      config.supportPolicy = ['lts'];
      githubDatasource.getDependency.mockReturnValueOnce({
        versions: {
          '4.4.4': {},
          '5.5.5': {},
          '6.11.0': {},
          '7.0.0': {},
          '8.9.4': {},
          '9.5.0': {},
        },
      });
      expect(await node.getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
