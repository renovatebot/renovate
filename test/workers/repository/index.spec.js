const repositoryWorker = require('../../../lib/workers/repository/index');
const apis = require('../../../lib/workers/repository/apis');
const onboarding = require('../../../lib/workers/repository/onboarding');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/repository/onboarding');

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
});
