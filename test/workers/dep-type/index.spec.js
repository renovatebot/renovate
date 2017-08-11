const packageJson = require('../../../lib/workers/dep-type/package-json');
const pkgWorker = require('../../../lib/workers/package/index');
const depTypeWorker = require('../../../lib/workers/dep-type/index');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/dep-type/package-json');
jest.mock('../../../lib/workers/package/index');

pkgWorker.renovatePackage = jest.fn(() => ['a']);

describe('lib/workers/dep-type/index', () => {
  describe('renovateDepType(packageContent, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ignoreDeps: ['a', 'b'],
        lernaPackages: ['e'],
      };
    });
    it('returns empty if config is disabled', async () => {
      config.enabled = false;
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns empty if no deps found', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([]);
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns empty if all deps are filtered', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([
        { depName: 'a' },
        { depName: 'b' },
        { depName: 'e' },
      ]);
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns combined upgrades if all deps are filtered', async () => {
      packageJson.extractDependencies.mockReturnValueOnce([
        { depName: 'a' },
        { depName: 'c' },
        { depName: 'd' },
      ]);
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toHaveLength(2);
    });
  });
  describe('getDepConfig(depTypeConfig, dep)', () => {
    const depTypeConfig = {
      foo: 'bar',
      logger,
      packageRules: [
        {
          packageNames: ['a', 'b'],
          x: 2,
        },
        {
          packagePatterns: ['a', 'b'],
          excludePackageNames: ['aa'],
          excludePackagePatterns: ['d'],
          y: 2,
        },
      ],
    };
    it('applies both rules for a', () => {
      const dep = {
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBe(2);
      expect(res.y).toBe(2);
      expect(res.packageRules).toBeUndefined();
    });
    it('applies both rules for b', () => {
      const dep = {
        depName: 'b',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBe(2);
      expect(res.y).toBe(2);
      expect(res.packageRules).toBeUndefined();
    });
    it('applies the second rule', () => {
      const dep = {
        depName: 'abc',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBe(2);
      expect(res.packageRules).toBeUndefined();
    });
    it('applies the second second rule', () => {
      const dep = {
        depName: 'bc',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBe(2);
      expect(res.packageRules).toBeUndefined();
    });
    it('excludes package name', () => {
      const dep = {
        depName: 'aa',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBeUndefined();
      expect(res.packageRules).toBeUndefined();
    });
    it('excludes package pattern', () => {
      const dep = {
        depName: 'bcd',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBeUndefined();
      expect(res.packageRules).toBeUndefined();
    });
  });
});
