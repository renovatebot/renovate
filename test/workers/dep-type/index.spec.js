const path = require('path');
const fs = require('fs');
const packageJson = require('../../../lib/workers/dep-type/package-json');
const pkgWorker = require('../../../lib/workers/package/index');
const depTypeWorker = require('../../../lib/workers/dep-type/index');

jest.mock('../../../lib/workers/dep-type/package-json');
jest.mock('../../../lib/workers/package/index');

pkgWorker.renovatePackage = jest.fn(() => ['a']);

describe('lib/workers/dep-type/index', () => {
  describe('renovateDepType(packageContent, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        packageFile: 'package.json',
        ignoreDeps: ['a', 'b'],
        monorepoPackages: ['e'],
        workspaceDir: '.',
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
    it('returns upgrades for meteor', async () => {
      config.packageFile = 'package.js';
      const content = fs.readFileSync(
        path.resolve('test/_fixtures/meteor/package-1.js'),
        'utf8'
      );
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(6);
    });
    it('handles malformed meteor', async () => {
      config.packageFile = 'package.js';
      const content = 'blah';
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(0);
    });
    it('returns upgrades for docker', async () => {
      config.packageFile = 'Dockerfile';
      config.currentFrom = 'node';
      const res = await depTypeWorker.renovateDepType(
        '# a comment\nFROM something\n',
        config
      );
      expect(res).toHaveLength(1);
    });
    it('ignores Dockerfiles with no FROM', async () => {
      config.packageFile = 'Dockerfile';
      config.currentFrom = 'node';
      const res = await depTypeWorker.renovateDepType(
        '# a comment\nRUN something\n',
        config
      );
      expect(res).toHaveLength(0);
    });
  });
  describe('getDepConfig(depTypeConfig, dep)', () => {
    const depTypeConfig = {
      foo: 'bar',

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
