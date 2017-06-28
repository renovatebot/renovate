const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');
const upgrades = require('../../../lib/workers/repository/upgrades');

const logger = require('../../_fixtures/logger');

apis.initApis = jest.fn(input => input);
apis.mergeRenovateJson = jest.fn(input => input);
apis.detectPackageFiles = jest.fn(input =>
  Object.assign(input, { packageFiles: ['package.json'] })
);

describe('workers/repository', () => {
  describe('renovateRepository', () => {
    let config;
    beforeEach(() => {
      onboarding.getOnboardingStatus = jest.fn();
      onboarding.ensurePr = jest.fn();
      upgrades.determineRepoUpgrades = jest.fn(() => []);
      upgrades.groupUpgradesByBranch = jest.fn(() => ({}));
      branchWorker.updateBranch = jest.fn();
      config = {
        api: {},
        logger,
        packageFiles: [],
      };
    });
    it('skips repository if no package.json', async () => {
      config.api.getFileJson = jest.fn(() => ({}));
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(0);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('does not skip repository if package.json', async () => {
      config.api.getFileJson = jest.fn(() => ({ a: 1 }));
      onboarding.getOnboardingStatus.mockReturnValueOnce(false);
      await repositoryWorker.renovateRepository(config);
      expect(onboarding.getOnboardingStatus.mock.calls.length).toBe(1);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
      expect(config.logger.error.mock.calls.length).toBe(0);
    });
    it('calls branchWorker', async () => {
      config.hasRenovateJson = true;
      onboarding.getOnboardingStatus.mockReturnValueOnce(true);
      upgrades.groupUpgradesByBranch.mockReturnValueOnce({
        foo: {},
        bar: {},
        baz: {},
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(3);
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
