const npmApi = require('../../../lib/api/npm');
const versions = require('../../../lib/workers/package/versions');
const pkgWorker = require('../../../lib/workers/package/index');

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
    it('returns empty if no npm dep found', async () => {
      const res = await pkgWorker.findUpgrades(config);
      expect(res).toMatchObject([]);
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
