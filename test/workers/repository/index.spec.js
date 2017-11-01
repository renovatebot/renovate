const { determineUpdates } = require('../../../lib/workers/repository/updates');
const { writeUpdates } = require('../../../lib/workers/repository/write');
const {
  ensureOnboardingPr,
} = require('../../../lib/workers/repository/onboarding/pr');
const { renovateRepository } = require('../../../lib/workers/repository/index');

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/updates');
jest.mock('../../../lib/workers/repository/onboarding/pr');
jest.mock('../../../lib/workers/repository/write');
jest.mock('../../../lib/workers/repository/cleanup');
jest.mock('../../../lib/manager/resolve');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    it('exits after 6 loops', async () => {
      const res = await renovateRepository(config, 'some-token', 6);
      expect(res).toMatchSnapshot();
    });
    it('writes', async () => {
      determineUpdates.mockReturnValue({ repoIsOnboarded: true });
      writeUpdates.mockReturnValueOnce('automerged');
      writeUpdates.mockReturnValueOnce('onboarded');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
    it('ensures onboarding pr', async () => {
      determineUpdates.mockReturnValue({ repoIsOnboarded: false });
      ensureOnboardingPr.mockReturnValue('onboarding');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
  });
});

/*
const branchWorker = require('../../../lib/workers/branch');

const init = require('../../../lib/workers/repository/init');
const manager = require('../../../lib/manager');
const onboarding = require('../../../lib/workers/repository/onboarding/pr');
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
      init.initApis = jest.fn(input => input);
      init.mergeRenovateJson = jest.fn(input => input);
      manager.detectPackageFiles = jest.fn();
      init.resolvePackageFiles = jest.fn(input => input);
      init.checkMonorepos = jest.fn(input => input);
      onboarding.ensurePr = jest.fn();
      onboarding.isOnboarded = jest.fn();
      onboarding.prExists = jest.fn();
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
    }); /*
    it('skips repository if config is disabled', async () => {
      config.enabled = false;
      await repositoryWorker.renovateRepository(config);
      expect(manager.detectPackageFiles.mock.calls.length).toBe(0);
    });
    it('skips repository if its unconfigured fork', async () => {
      config.isFork = true;
      config.renovateJsonPresent = false;
      await repositoryWorker.renovateRepository(config);
      expect(manager.detectPackageFiles.mock.calls.length).toBe(0);
    });
    it('does not skip repository if its a configured fork', async () => {
      config.isFork = true;
      config.renovateFork = true;
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
    });
    it('sets custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(true);
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(1);
    }); /*
    it('errors when missing custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(false);
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(0);
    });
    it('skips repository if no package.json', async () => {
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      await repositoryWorker.renovateRepository(config);
      expect(init.resolvePackageFiles.mock.calls.length).toBe(0);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('does not skip repository if package.json', async () => {
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('uses onboarding custom baseBranch', async () => {
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'], baseBranch: 'next' },
      }));
      config.api.branchExists.mockReturnValueOnce(true);
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('errors onboarding custom baseBranch', async () => {
      manager.detectPackageFiles.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: ['package.json'] },
      }));
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [] },
      }));
      init.mergeRenovateJson.mockImplementationOnce(input => ({
        ...input,
        ...{ packageFiles: [], baseBranch: 'next' },
      }));
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.processBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('calls branchWorker', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
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
    it('only processes pins first', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{ isPin: true }, {}, {}],
      });
      branchWorker.processBranch.mockReturnValue('done');
      await repositoryWorker.renovateRepository(config);
      expect(upgrades.branchifyUpgrades.mock.calls).toHaveLength(1);
      expect(branchWorker.processBranch.mock.calls).toHaveLength(1);
      expect(config.logger.error.mock.calls).toHaveLength(0);
    });
    it('swallows errors', async () => {
      init.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.renovateRepository(config);
      expect(config.logger.error.mock.calls.length).toBe(1);
    });
    it('handles special uninitiated error', async () => {
      init.initApis.mockImplementationOnce(() => {
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
    it('handles special no package files error', async () => {
      init.initApis.mockImplementationOnce(() => {
        // Create a new object, that prototypically inherits from the Error constructor
        function MyError() {
          this.message = 'no package files';
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
*/
