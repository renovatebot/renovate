const repositoryWorker = require('../../../lib/workers/repository/index');
const branchWorker = require('../../../lib/workers/branch');

const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');
const upgrades = require('../../../lib/workers/repository/upgrades');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/repository/onboarding');
jest.mock('../../../lib/workers/repository/upgrades');
jest.mock('../../../lib/workers/branch');

apis.initApis = jest.fn(input => input);
apis.mergeRenovateJson = jest.fn(input => input);
apis.detectPackageFiles = jest.fn(input => input);

describe('workers/repository', () => {
  describe('renovateRepository', () => {
    let config;
    beforeEach(() => {
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
    it('swallows errors', async () => {
      apis.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.renovateRepository(config);
    });
  });
});
