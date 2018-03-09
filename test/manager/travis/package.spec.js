const node = require('../../../lib/manager/travis/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const githubDatasource = require('../../../lib/datasource/github');

jest.mock('../../../lib/datasource/github');

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
    it('detects pinning', async () => {
      config.currentVersion = ['6.1.0', '8.4.0'];
      githubDatasource.getRepoReleases.mockReturnValueOnce([
        'v4.4.4',
        'v5.5.5',
        'v6.11.0',
        'v7.0.0',
        'v8.9.4',
        'v9.5.0',
      ]);
      expect(await node.getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
