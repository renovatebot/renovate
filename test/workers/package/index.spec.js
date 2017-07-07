const npmApi = require('../../../lib/api/npm');
const versions = require('../../../lib/workers/package/versions');
const pkgWorker = require('../../../lib/workers/package/index');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const configParser = require('../../../lib/config');

jest.mock('../../../lib/workers/branch/schedule');
jest.mock('../../../lib/workers/package/versions');
jest.mock('../../../lib/api/npm');

describe('lib/workers/package/index', () => {
  describe('findUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = configParser.filterConfig(defaultConfig, 'package');
      config.depName = 'foo';
    });
    it('returns empty if package is disabled', async () => {
      config.enabled = false;
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
    });
    it('returns error if no npm dep found', async () => {
      config.repoIsOnboarded = true;
      config.schedule = 'some schedule';
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('error');
      expect(npmApi.getDependency.mock.calls.length).toBe(1);
    });
    it('returns warning if warning found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades.mockReturnValueOnce([
        {
          type: 'warning',
          message: 'bad version',
        },
      ]);
      const res = await pkgWorker.findUpgrades(config);
      expect(res[0].type).toEqual('warning');
    });
    it('returns array if upgrades found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades.mockReturnValueOnce([{}]);
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toHaveLength(1);
      expect(Object.keys(res[0])).toMatchSnapshot();
    });
  });
});
