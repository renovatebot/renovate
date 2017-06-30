const npmApi = require('../../../lib/api/npm');
const schedule = require('../../../lib/workers/package/schedule');
const versions = require('../../../lib/workers/package/versions');
const pkgWorker = require('../../../lib/workers/package/index');

jest.mock('../../../lib/workers/package/schedule');
jest.mock('../../../lib/workers/package/versions');
jest.mock('../../../lib/api/npm');

describe('lib/workers/package/index', () => {
  describe('findUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        depName: 'foo',
      };
    });
    it('returns empty if package is disabled', async () => {
      config.enabled = false;
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
    });
    it('returns empty if package is not scheduled', async () => {
      config.schedule = 'some schedule';
      schedule.isPackageScheduled.mockReturnValueOnce(false);
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
      expect(npmApi.getDependency.mock.calls.length).toBe(0);
    });
    it('returns empty if no npm dep found', async () => {
      config.schedule = 'some schedule';
      schedule.isPackageScheduled.mockReturnValueOnce(true);
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
      expect(npmApi.getDependency.mock.calls.length).toBe(1);
    });
    it('returns empty if no upgrades found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades.mockReturnValueOnce([]);
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
    });
    it('returns array if upgrades found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades.mockReturnValueOnce([{}]);
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toHaveLength(1);
    });
  });
});
