const path = require('path');
const fs = require('fs');
const npmExtract = require('../../../lib/manager/npm/extract');
const pkgWorker = require('../../../lib/workers/package-file/package');
const depTypeWorker = require('../../../lib/workers/package-file/dep-type');

jest.mock('../../../lib/manager/npm/extract');
jest.mock('../../../lib/workers/package-file/package');

pkgWorker.renovatePackage = jest.fn(() => ['a']);

describe('lib/workers/package-file/dep-type', () => {
  describe('renovateDepType(packageContent, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        packageFile: 'package.json',
        manager: 'npm',
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
      npmExtract.extractDependencies.mockReturnValueOnce(null);
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns empty if all deps are filtered', async () => {
      npmExtract.extractDependencies.mockReturnValueOnce({
        deps: [{ depName: 'a' }, { depName: 'b' }, { depName: 'e' }],
      });
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toMatchObject([]);
    });
    it('returns combined upgrades if all deps are filtered', async () => {
      npmExtract.extractDependencies.mockReturnValueOnce({
        deps: [{ depName: 'a' }, { depName: 'c' }, { depName: 'd' }],
      });
      const res = await depTypeWorker.renovateDepType({}, config);
      expect(res).toHaveLength(2);
    });
    it('returns upgrades for meteor', async () => {
      config.manager = 'meteor';
      const content = fs.readFileSync(
        path.resolve('test/_fixtures/meteor/package-1.js'),
        'utf8'
      );
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(6);
    });
    it('returns upgrades for bazel', async () => {
      config.manager = 'bazel';
      const content = fs.readFileSync(
        path.resolve('test/_fixtures/bazel/WORKSPACE1'),
        'utf8'
      );
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(4);
    });
    it('returns upgrades for travis', async () => {
      config.manager = 'travis';
      const content = fs.readFileSync(
        path.resolve('test/_fixtures/node/travis.yml'),
        'utf8'
      );
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(1);
    });
    it('handles malformed meteor', async () => {
      config.manager = 'meteor';
      const content = 'blah';
      const res = await depTypeWorker.renovateDepType(content, config);
      expect(res).toHaveLength(0);
    });
    it('returns upgrades for docker', async () => {
      config.manager = 'docker';
      config.currentFrom = 'node';
      const res = await depTypeWorker.renovateDepType(
        '# a comment\nFROM something\n',
        config
      );
      expect(res).toHaveLength(1);
    });
    it('ignores Dockerfiles with no FROM', async () => {
      config.manager = 'docker';
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
    it('matches anything if missing inclusive rules', () => {
      const allConfig = {
        packageRules: [
          {
            excludePackageNames: ['foo'],
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(allConfig, {
        depName: 'foo',
      });
      expect(res1.x).toBeUndefined();
      const res2 = depTypeWorker.getDepConfig(allConfig, {
        depName: 'bar',
      });
      expect(res2.x).toBeDefined();
    });
    it('supports inclusive or', () => {
      const nConfig = {
        packageRules: [
          {
            packageNames: ['neutrino'],
            packagePatterns: ['^@neutrino\\/'],
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(nConfig, { depName: 'neutrino' });
      expect(res1.x).toBeDefined();
      const res2 = depTypeWorker.getDepConfig(nConfig, {
        depName: '@neutrino/something',
      });
      expect(res2.x).toBeDefined();
    });
    it('applies both rules for a', () => {
      const dep = {
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBe(2);
      expect(res.y).toBe(2);
    });
    it('applies both rules for b', () => {
      const dep = {
        depName: 'b',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBe(2);
      expect(res.y).toBe(2);
    });
    it('applies the second rule', () => {
      const dep = {
        depName: 'abc',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBe(2);
    });
    it('applies the second second rule', () => {
      const dep = {
        depName: 'bc',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBe(2);
    });
    it('excludes package name', () => {
      const dep = {
        depName: 'aa',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBeUndefined();
    });
    it('excludes package pattern', () => {
      const dep = {
        depName: 'bcd',
      };
      const res = depTypeWorker.getDepConfig(depTypeConfig, dep);
      expect(res.x).toBeUndefined();
      expect(res.y).toBeUndefined();
    });
    it('filters depType', () => {
      const config = {
        packageRules: [
          {
            depTypeList: ['dependencies', 'peerDependencies'],
            packageNames: ['a'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'dependencies',
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(config, dep);
      expect(res.x).toBe(1);
    });
    it('filters naked depType', () => {
      const config = {
        packageRules: [
          {
            depTypeList: ['dependencies', 'peerDependencies'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'dependencies',
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(config, dep);
      expect(res.x).toBe(1);
    });
    it('filters depType', () => {
      const config = {
        packageRules: [
          {
            depTypeList: ['dependencies', 'peerDependencies'],
            packageNames: ['a'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'devDependencies',
        depName: 'a',
      };
      const res = depTypeWorker.getDepConfig(config, dep);
      expect(res.x).toBeUndefined();
    });
    it('checks if matchCurrentVersion selector is valid and satisfies the condition on range overlap', () => {
      const config = {
        packageRules: [
          {
            packageNames: ['test'],
            matchCurrentVersion: '<= 2.0.0',
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
        currentVersion: '^1.0.0',
      });
      expect(res1.x).toBeDefined();
    });
    it('checks if matchCurrentVersion selector is valid and satisfies the condition on pinned to range overlap', () => {
      const config = {
        packageRules: [
          {
            packageNames: ['test'],
            matchCurrentVersion: '>= 2.0.0',
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
        currentVersion: '2.4.6',
      });
      expect(res1.x).toBeDefined();
    });
    it('checks if matchCurrentVersion selector works with static values', () => {
      const config = {
        packageRules: [
          {
            packageNames: ['test'],
            matchCurrentVersion: '4.6.0',
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
        currentVersion: '4.6.0',
      });
      expect(res1.x).toBeDefined();
    });
    it('matches paths', () => {
      const config = {
        packageFile: 'examples/foo/package.json',
        packageRules: [
          {
            paths: ['examples/**', 'lib/'],
            x: 1,
          },
        ],
      };
      const res1 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
      });
      expect(res1.x).toBeDefined();
      config.packageFile = 'package.json';
      const res2 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
      });
      expect(res2.x).toBeUndefined();
      config.packageFile = 'lib/a/package.json';
      const res3 = depTypeWorker.getDepConfig(config, {
        depName: 'test',
      });
      expect(res3.x).toBeDefined();
    });
  });
});
