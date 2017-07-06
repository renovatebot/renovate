const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');
const upgrades = require('../../../lib/workers/repository/upgrades');

const logger = require('../../_fixtures/logger');

apis.initApis = jest.fn(input => input);
apis.mergeRenovateJson = jest.fn(input => input);
apis.detectPackageFiles = jest.fn();

describe('workers/repository', () => {
  describe('renovateRepository', () => {
    let config;
    beforeEach(() => {
      onboarding.getOnboardingStatus = jest.fn();
      onboarding.ensurePr = jest.fn();
      upgrades.determineRepoUpgrades = jest.fn(() => []);
      upgrades.branchifyUpgrades = jest.fn(() => ({ branchUpgrades: {} }));
      branchWorker.processBranchUpgrades = jest.fn(() => 'some-branch');
      config = {
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
    it('sets custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(true);
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(1);
    });
    it('errors when missing custom base branch', async () => {
      config.baseBranch = 'some-branch';
      config.api.branchExists.mockReturnValueOnce(false);
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      await repositoryWorker.renovateRepository(config);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(0);
    });
    it('skips repository if no package.json', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(0);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('does not skip repository if package.json', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranchUpgrades.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('uses onboarding custom baseBranch', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [], baseBranch: 'next' })
      );
      config.api.branchExists.mockReturnValueOnce(true);
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranchUpgrades.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('errors onboarding custom baseBranch', async () => {
      apis.detectPackageFiles.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [] })
      );
      apis.mergeRenovateJson.mockImplementationOnce(input =>
        Object.assign(input, { packageFiles: [], baseBranch: 'next' })
      );
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.processBranchUpgrades.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('calls branchWorker', async () => {
      config.packageFiles = ['package.json'];
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockReturnValueOnce(true);
      upgrades.branchifyUpgrades.mockReturnValueOnce({
        upgrades: [{}, {}, {}],
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.processBranchUpgrades.mock.calls.length).toBe(3);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('swallows errors', async () => {
      apis.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.renovateRepository(config);
      expect(config.logger.error.mock.calls.length).toBe(1);
    });
  });
});
