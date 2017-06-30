const packageJson = require('../../../lib/workers/dep-type/package-json');
const pkgWorker = require('../../../lib/workers/package/index');
const depTypeWorker = require('../../../lib/workers/dep-type/index');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/dep-type/package-json');
jest.mock('../../../lib/workers/package/index');

pkgWorker.findUpgrades = jest.fn(() => ['a']);

describe('lib/workers/dep-type/index', () => {
  describe('findUpgrades(packageContent, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ignoreDeps: ['a', 'b'],
      };
    });
    it('returns empty if config is disabled', async () => {
      config.enabled = false;
      const res = await depTypeWorker.findUpgrades({}, config);
      expect(res).toMatchObject([]);
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
  describe('getDepConfig(depTypeConfig, dep)', () => {
    const depTypeConfig = {
      foo: 'bar',
      logger,
      packages: [
        {
          packageName: 'a',
          x: 2,
        },
        {
          packagePattern: 'a',
          y: 2,
        },
      ],
    };
    it('applies only one rule', () => {
      const dep = {
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBe(2);
      expect(res.y).toBeUndefined();
      expect(res.packages).toBeUndefined();
    });
    it('applies the second rule', () => {
      const dep = {
        depName: 'abc',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBe(2);
      expect(res.packages).toBeUndefined();
    });
  });
});
