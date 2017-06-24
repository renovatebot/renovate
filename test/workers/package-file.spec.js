const packageFileWorker = require('../../lib/workers/package-file');
const npmApi = require('../../lib/api/npm');
const versionsHelper = require('../../lib/helpers/versions');
const packageJsonHelper = require('../../lib/helpers/package-json');
const logger = require('../_fixtures/logger');

jest.mock('../../lib/workers/branch');
jest.mock('../../lib/workers/pr');
jest.mock('../../lib/api/npm');
jest.mock('../../lib/helpers/versions');

describe('packageFileWorker', () => {
  describe('findUpgrades(dependencies, config)', () => {
    let config;
    beforeEach(() => {
      config = {};
      packageFileWorker.updateBranch = jest.fn();
    });
    it('handles null', async () => {
      const allUpgrades = await packageFileWorker.findUpgrades([], config);
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
      const allUpgrades = await packageFileWorker.findUpgrades([dep], config);
      expect(allUpgrades).toMatchObject([Object.assign({}, dep, upgrade)]);
    });
    it('handles no return', async () => {
      const dep = {
        depName: 'foo',
        currentVersion: '1.0.0',
      };
      const upgrade = { newVersion: '1.1.0' };
      npmApi.getDependency = jest.fn(() => ({}));
      npmApi.getDependency.mockReturnValueOnce(null);
      versionsHelper.determineUpgrades = jest.fn(() => [upgrade]);
      const allUpgrades = await packageFileWorker.findUpgrades([dep], config);
      expect(allUpgrades).toMatchObject([]);
    });
    it('handles no upgrades', async () => {
      const dep = {
        depName: 'foo',
        currentVersion: '1.0.0',
      };
      npmApi.getDependency = jest.fn(() => ({}));
      versionsHelper.determineUpgrades = jest.fn(() => []);
      const allUpgrades = await packageFileWorker.findUpgrades([dep], config);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchObject([]);
    });
    it('handles string deps', () => {
      config.foo = 'bar';
      config.depTypes = ['dependencies', 'devDependencies'];
      deps.push({
        depName: 'a',
      });
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
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
      const updatedDeps = packageFileWorker.assignDepConfigs(config, deps);
      expect(updatedDeps).toMatchSnapshot();
    });
  });
  describe('getDepTypeConfig(depTypes, depTypeName)', () => {
    it('handles empty depTypes', () => {
      const depTypeConfig = packageFileWorker.getDepTypeConfig(
        [],
        'dependencies'
      );
      expect(depTypeConfig).toMatchObject({});
    });
    it('handles all strings', () => {
      const depTypes = ['dependencies', 'devDependencies'];
      const depTypeConfig = packageFileWorker.getDepTypeConfig(
        depTypes,
        'dependencies'
      );
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
      const depTypeConfig = packageFileWorker.getDepTypeConfig(
        depTypes,
        'dependencies'
      );
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
      const depTypeConfig = packageFileWorker.getDepTypeConfig(
        depTypes,
        'dependencies'
      );
      const expectedResult = {
        foo: 'bar',
      };
      expect(depTypeConfig).toMatchObject(expectedResult);
    });
  });
  describe('processPackageFile(config)', () => {
    let config;
    beforeEach(() => {
      packageFileWorker.assignDepConfigs = jest.fn(() => []);
      packageFileWorker.findUpgrades = jest.fn(() => []);
      packageJsonHelper.extractDependencies = jest.fn(() => []);
      config = require('../../lib/config/defaults').getConfig();
      config.api = {
        getFileJson: jest.fn(() => ({})),
      };
      config.logger = logger;
    });
    it('returns empty array if no package content', async () => {
      config.api.getFileJson.mockReturnValueOnce(null);
      const res = await packageFileWorker.processPackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns empty array if config disabled', async () => {
      config.api.getFileJson.mockReturnValueOnce({
        renovate: {
          enabled: false,
        },
      });
      const res = await packageFileWorker.processPackageFile(config);
      expect(res).toEqual([]);
    });
    it('extracts dependencies for each depType', async () => {
      config.depTypes = [
        'dependencies',
        {
          depType: 'devDependencies',
          foo: 'bar',
        },
      ];
      const res = await packageFileWorker.processPackageFile(config);
      expect(res).toEqual([]);
      expect(
        packageJsonHelper.extractDependencies.mock.calls
      ).toMatchSnapshot();
    });
    it('filters dependencies', async () => {
      packageJsonHelper.extractDependencies.mockReturnValueOnce([
        {
          depName: 'a',
        },
      ]);
      packageFileWorker.assignDepConfigs.mockReturnValueOnce(['a']);
      packageFileWorker.findUpgrades.mockReturnValueOnce(['a']);
      const res = await packageFileWorker.processPackageFile(config);
      expect(res).toHaveLength(1);
      expect(res).toMatchSnapshot();
    });
    it('maintains yarn.lock', async () => {
      config.maintainYarnLock = true;
      const res = await packageFileWorker.processPackageFile(config);
      expect(res).toHaveLength(1);
    });
  });
});
