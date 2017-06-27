const packageJson = require('../../../lib/workers/dep-type/package-json');
const pkgWorker = require('../../../lib/workers/package/index');
const depTypeWorker = require('../../../lib/workers/dep-type/index');
// const configParser = require('../../../lib/config');

jest.mock('../../../lib/workers/dep-type/package-json');
jest.mock('../../../lib/workers/package/index');
jest.mock('../../../lib/config');

pkgWorker.findUpgrades = jest.fn(() => ['a']);

describe('lib/workers/dep-type/index', () => {
  describe('findUpgrades(packageContent, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ignoreDeps: ['a', 'b'],
      };
    });
    it('returns empty if no deps found', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([]);
      const res = await depTypeWorker.findUpgrades({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns empty if all deps are filtered', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([
        { depName: 'a' },
        { depName: 'b' },
      ]);
      const res = await depTypeWorker.findUpgrades({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns combined upgrades if all deps are filtered', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([
        { depName: 'a' },
        { depName: 'c' },
        { depName: 'd' },
      ]);
      const res = await depTypeWorker.findUpgrades({}, config);
      expect(res).toHaveLength(2);
    });
  });
});
