const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');
const upgrades = require('../../../lib/workers/repository/upgrades');

const logger = require('../../_fixtures/logger');

apis.initApis = jest.fn(input => input);
apis.mergeRenovateJson = jest.fn(input => input);
apis.detectPackageFiles = jest.fn(input => input);

describe('workers/repository', () => {
  describe('renovateRepository', () => {
    let config;
    beforeEach(() => {
      onboarding.getOnboardingStatus = jest.fn();
      onboarding.ensurePr = jest.fn();
      upgrades.groupUpgradesByBranch = jest.fn();
      branchWorker.updateBranch = jest.fn();
      config = {
        logger,
        packageFiles: [],
      };
    });
    it('returns early if repo is not onboarded', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(false);
      await repositoryWorker.renovateRepository(config);
    });
    it('detects package files if none configured', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(true);
      await repositoryWorker.renovateRepository(config);
    });
    it('calls branchWorker', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(true);
      upgrades.groupUpgradesByBranch.mockReturnValueOnce({
        foo: {},
        bar: {},
        baz: {},
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(3);
    });
    it('calls ensurePr', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(false);
      upgrades.groupUpgradesByBranch.mockReturnValueOnce({
        foo: {},
        bar: {},
        baz: {},
      });
      await repositoryWorker.renovateRepository(config);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(0);
      expect(onboarding.ensurePr.mock.calls.length).toBe(1);
    });
    it('swallows errors', async () => {
      apis.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.renovateRepository(config);
    });
  });
});
