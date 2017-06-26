const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/repository/onboarding');
jest.mock('../../../lib/workers/branch');

apis.initApis = jest.fn(input => input);
apis.mergeRenovateJson = jest.fn(input => input);
apis.detectPackageFiles = jest.fn(input => input);

describe('workers/repository', () => {
  describe('processRepo', () => {
    let config;
    beforeEach(() => {
      config = {
        logger,
        packageFiles: [],
      };
    });
    it('returns early if repo is not onboarded', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(false);
      await repositoryWorker.processRepo(config);
    });
    it('detects package files if none configured', async () => {
      onboarding.getOnboardingStatus.mockReturnValueOnce(true);
      await repositoryWorker.processRepo(config);
    });
    it('swallows errors', async () => {
      apis.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.processRepo(config);
    });
  });
  describe('updateBranchesSequentially(branchUpgrades, logger)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('handles empty case', async () => {
      await repositoryWorker.updateBranchesSequentially({}, logger);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(0);
    });
    it('updates branches', async () => {
      const branchUpgrades = {
        foo: {},
        bar: {},
        baz: {},
      };
      await repositoryWorker.updateBranchesSequentially(branchUpgrades, logger);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(3);
    });
  });
});
