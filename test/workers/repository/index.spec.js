const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');
const upgrades = require('../../../lib/workers/repository/upgrades');

const logger = require('../../_fixtures/logger');

describe('workers/repository', () => {
  describe('pinDependenciesFirst', () => {
    it('returns sorted if no pin', () => {
      const arr = [
        { branchName: 'a' },
        { branchName: 'c' },
        { branchName: 'b' },
      ];
      arr.sort(repositoryWorker.pinDependenciesFirst);
      expect(arr).toMatchSnapshot();
    });
    it('returns pin first', () => {
      const arr = [
        { branchName: 'a' },
        { branchName: 'c' },
        { branchName: 'd', type: 'pin' },
        { branchName: 'b' },
      ];
      arr.sort(repositoryWorker.pinDependenciesFirst);
      expect(arr).toMatchSnapshot();
    });
    it('returns pin first', () => {
      const arr = [
        { branchName: 'd', type: 'pin' },
        { branchName: 'a' },
        { branchName: 'c' },
        { branchName: 'b' },
      ];
      arr.sort(repositoryWorker.pinDependenciesFirst);
      expect(arr).toMatchSnapshot();
    });
  });
  describe('renovateRepository', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      apis.initApis = jest.fn(input => input);
      apis.mergeRenovateJson = jest.fn(input => input);
      apis.detectPackageFiles = jest.fn();
      apis.resolvePackageFiles = jest.fn(input => input);
      apis.checkMonorepos = jest.fn(input => input);
      onboarding.getOnboardingStatus = jest.fn(input => input);
      onboarding.ensurePr = jest.fn();
      upgrades.determineRepoUpgrades = jest.fn(() => []);
      upgrades.branchifyUpgrades = jest.fn(() => ({ branchUpgrades: {} }));
      branchWorker.processBranch = jest.fn(() => 'done');
      config = {
        lockFileMaintenance: true,
        api: {
          getFileJson: jest.fn(),
          setBaseBranch: jest.fn(),
          branchExists: jest.fn(),
        },
        logger,
        packageFiles: [],
      };
    });
    it('skips repository if config is disabled', async () => {
      config.enabled = false;
      await repositoryWorker.renovateRepository(config);
      expect(apis.detectPackageFiles.mock.calls.length).toBe(0);
    });
    it('skips repository if its unconfigured fork', async () => {
      config.isFork = true;
      config.renovateJsonPresent = false;
      await repositoryWorker.renovateRepository(config);
      expect(apis.detectPackageFiles.mock.calls.length).toBe(0);
    });
    it('sets custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(true);
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(1);
    });
    it('errors when missing custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(false);
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(0);
    });
    it('skips repository if no package.json', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(0);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('does not skip repository if package.json', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('uses onboarding custom baseBranch', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'], baseBranch: 'next' },
      }));
      config.api.branchExists.mockReturnValueOnce(true);
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('errors onboarding custom baseBranch', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      apis.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [], baseBranch: 'next' },
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('calls branchWorker', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockImplementation(input => ({
        ...input,
        repoIsOnboarded: true,
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.processBranch.mock.calls.length).toBe(3);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('skips branchWorker after automerging', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockImplementation(input => ({
        ...input,
        repoIsOnboarded: true,
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}],
      });
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}],
      });
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [],
      });
      branchWorker.processBranch.mockReturnValue('automerged');
      await repositoryWorker.renovateRepository(config);
      expect(upgrades.branchifyUpgrades.mock.calls).toHaveLength(4);
      expect(branchWorker.processBranch.mock.calls).toHaveLength(3);
      expect(config.logger.error.mock.calls).toHaveLength(0);
    });
    it('stops branchWorker after lockFileError', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockImplementation(input => ({
        ...input,
        repoIsOnboarded: true,
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      branchWorker.processBranch.mockReturnValue('lockFileError');
      await repositoryWorker.renovateRepository(config);
      expect(upgrades.branchifyUpgrades.mock.calls).toHaveLength(1);
      expect(branchWorker.processBranch.mock.calls).toHaveLength(1);
      expect(config.logger.error.mock.calls).toHaveLength(0);
    });
    it('stops branchWorker after pin', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockImplementation(input => ({
        ...input,
        repoIsOnboarded: true,
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{ type: 'pin' }, {}, {}],
      });
      branchWorker.processBranch.mockReturnValue('done');
      await repositoryWorker.renovateRepository(config);
      expect(upgrades.branchifyUpgrades.mock.calls).toHaveLength(1);
      expect(branchWorker.processBranch.mock.calls).toHaveLength(1);
      expect(config.logger.error.mock.calls).toHaveLength(0);
    });
    it('swallows errors', async () => {
      apis.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.renovateRepository(config);
      expect(config.logger.error.mock.calls.length).toBe(1);
    });
    it('handles special uninitiated error', async () => {
      apis.initApis.mockImplementationOnce(() => {
        // Create a new object, that prototypically inherits from the Error constructor
        function MyError() {
          this.message = 'uninitiated';
        }
        MyError.prototype = Object.create(Error.prototype);
        MyError.prototype.constructor = MyError;
        throw new MyError();
      });
      await repositoryWorker.renovateRepository(config);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
  });
});
