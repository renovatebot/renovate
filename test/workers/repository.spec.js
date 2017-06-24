const repositoryWorker = require('../../lib/workers/repository');
const logger = require('../_fixtures/logger');

repositoryWorker.initApis = jest.fn(input => input);
repositoryWorker.mergeRenovateJson = jest.fn(input => input);
repositoryWorker.getOnboardingStatus = jest.fn(() => true);
repositoryWorker.detectPackageFiles = jest.fn(input => input);

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
      repositoryWorker.getOnboardingStatus.mockReturnValueOnce(false);
      await repositoryWorker.processRepo(config);
    });
    it('detects package files if none configured', async () => {
      repositoryWorker.getOnboardingStatus.mockReturnValueOnce(true);
      await repositoryWorker.processRepo(config);
    });
    it('swallows errors', async () => {
      repositoryWorker.initApis.mockImplementationOnce(() => {
        throw new Error('bad init');
      });
      await repositoryWorker.processRepo(config);
    });
  });
});
