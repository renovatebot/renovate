const logger = require('winston');
const worker = require('../lib/worker');
const branchWorker = require('../lib/workers/branch');
const prWorker = require('../lib/workers/pr');
const defaultConfig = require('../lib/config/defaults').getConfig();
const npmApi = require('../lib/api/npm');
const versionsHelper = require('../lib/helpers/versions');

logger.remove(logger.transports.Console);

jest.mock('../lib/workers/branch');
jest.mock('../lib/workers/pr');
jest.mock('../lib/api/npm');
jest.mock('../lib/helpers/versions');

describe('worker', () => {
  describe('updateDependency(upgrade)', () => {
    let config;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      config.api = {
        checkForClosedPr: jest.fn(),
      };
      branchWorker.ensureBranch = jest.fn();
      prWorker.ensurePr = jest.fn();
    });
    it('returns immediately if closed PR found', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
    it('does not return immediately if recreateClosed true', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      config.recreateClosed = true;
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('pins', async () => {
      config.upgradeType = 'pin';
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('majors', async () => {
      config.upgradeType = 'major';
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('minors', async () => {
      config.upgradeType = 'minor';
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('handles errors', async () => {
      config.api.checkForClosedPr = jest.fn(() => {
        throw new Error('oops');
      });
      await worker.updateBranch([config]);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
  });
  describe('processUpgrades(upgrades)', () => {
    beforeEach(() => {
      worker.updateBranch = jest.fn();
    });
    it('handles zero upgrades', async () => {
      await worker.processUpgrades([]);
      expect(worker.updateBranch.mock.calls.length).toBe(0);
    });
    it('handles non-zero upgrades', async () => {
      await worker.processUpgrades([{ branchName: 'a' }, { branchName: 'b' }]);
      expect(worker.updateBranch.mock.calls.length).toBe(2);
    });
  });
  describe('findUpgrades(dependencies, config)', () => {
    let config;
    beforeEach(() => {
      config = {};
      worker.updateBranch = jest.fn();
    });
    it('handles null', async () => {
      const allUpgrades = await worker.findUpgrades([], config);
      expect(allUpgrades).toMatchObject([]);
    });
    it('handles one dep', async () => {
      const dep = {
        depName: 'foo',
        currentVersion: '1.0.0',
      };
      const upgrade = { newVersion: '1.1.0' };
      npmApi.getDependency = jest.fn(() => ({}));
      versionsHelper.determineUpgrades = jest.fn(() => [upgrade]);
      const allUpgrades = await worker.findUpgrades([dep], config);
      expect(allUpgrades).toMatchObject([Object.assign({}, dep, upgrade)]);
    });
    it('handles no upgrades', async () => {
      const dep = {
        depName: 'foo',
        currentVersion: '1.0.0',
      };
      npmApi.getDependency = jest.fn(() => ({}));
      versionsHelper.determineUpgrades = jest.fn(() => []);
      const allUpgrades = await worker.findUpgrades([dep], config);
      expect(allUpgrades).toMatchObject([]);
    });
  });
  describe('assignDepConfigs(inputConfig, deps)', () => {
    let config;
    let deps;
    beforeEach(() => {
      config = {};
      deps = [];
    });
    it('handles empty deps', () => {
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchObject([]);
    });
    it('handles string deps', () => {
      config.foo = 'bar';
      config.depTypes = ['dependencies', 'devDependencies'];
      deps.push({
        depName: 'a',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles multiple deps', () => {
      config.foo = 'bar';
      deps.push({
        depName: 'a',
      });
      deps.push({
        depName: 'b',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles depType config without override', () => {
      config.foo = 'bar';
      config.depTypes = [
        {
          depType: 'dependencies',
          alpha: 'beta',
        },
      ];
      deps.push({
        depName: 'a',
        depType: 'dependencies',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles depType config with override', () => {
      config.foo = 'bar';
      config.depTypes = [
        {
          depType: 'dependencies',
          foo: 'beta',
        },
      ];
      deps.push({
        depName: 'a',
        depType: 'dependencies',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles package config', () => {
      config.foo = 'bar';
      config.packages = [
        {
          packageName: 'a',
          labels: ['renovate'],
        },
      ];
      deps.push({
        depName: 'a',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('package config overrides depType and general config', () => {
      config.foo = 'bar';
      config.depTypes = [
        {
          depType: 'dependencies',
          foo: 'beta',
        },
      ];
      config.packages = [
        {
          packageName: 'a',
          foo: 'gamma',
        },
      ];
      deps.push({
        depName: 'a',
        depType: 'dependencies',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('nested package config overrides depType and general config', () => {
      config.foo = 'bar';
      config.depTypes = [
        {
          depType: 'dependencies',
          foo: 'beta',
          packages: [
            {
              packageName: 'a',
              foo: 'gamma',
            },
          ],
        },
      ];
      deps.push({
        depName: 'a',
        depType: 'dependencies',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles regex package pattern', () => {
      config.foo = 'bar';
      config.packages = [
        {
          packagePattern: 'eslint',
          labels: ['eslint'],
        },
      ];
      deps.push({
        depName: 'eslint',
      });
      deps.push({
        depName: 'eslint-foo',
      });
      deps.push({
        depName: 'a',
      });
      deps.push({
        depName: 'also-eslint',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles regex wildcard package pattern', () => {
      config.foo = 'bar';
      config.packages = [
        {
          packagePattern: '^eslint',
          labels: ['eslint'],
        },
      ];
      deps.push({
        depName: 'eslint',
      });
      deps.push({
        depName: 'eslint-foo',
      });
      deps.push({
        depName: 'a',
      });
      deps.push({
        depName: 'also-eslint',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
    it('handles non-regex package name', () => {
      config.foo = 'bar';
      config.packages = [
        {
          packageName: 'eslint',
          labels: ['eslint'],
        },
      ];
      deps.push({
        depName: 'eslint',
      });
      deps.push({
        depName: 'eslint-foo',
      });
      deps.push({
        depName: 'a',
      });
      deps.push({
        depName: 'also-eslint',
      });
      const updatedDeps = worker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
  });
  describe('getDepTypeConfig(depTypes, depTypeName)', () => {
    it('handles empty depTypes', () => {
      const depTypeConfig = worker.getDepTypeConfig([], 'dependencies');
      expect(depTypeConfig).toMatchObject({});
    });
    it('handles all strings', () => {
      const depTypes = ['dependencies', 'devDependencies'];
      const depTypeConfig = worker.getDepTypeConfig(depTypes, 'dependencies');
      expect(depTypeConfig).toMatchObject({});
    });
    it('handles missed object', () => {
      const depTypes = [
        'dependencies',
        {
          depType: 'devDependencies',
          foo: 'bar',
        },
      ];
      const depTypeConfig = worker.getDepTypeConfig(depTypes, 'dependencies');
      expect(depTypeConfig).toMatchObject({});
    });
    it('handles hit object', () => {
      const depTypes = [
        {
          depType: 'dependencies',
          foo: 'bar',
        },
        'devDependencies',
      ];
      const depTypeConfig = worker.getDepTypeConfig(depTypes, 'dependencies');
      const expectedResult = {
        foo: 'bar',
      };
      expect(depTypeConfig).toMatchObject(expectedResult);
    });
  });
});
