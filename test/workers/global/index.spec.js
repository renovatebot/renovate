const globalWorker = require('../../../lib/workers/global');
const repositoryWorker = require('../../../lib/workers/repository');
const configParser = require('../../../lib/config');
const platform = require('../../../lib/platform');

jest.mock('../../../lib/platform');

describe('lib/workers/global', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    configParser.parseConfigs = jest.fn();
    configParser.getRepositoryConfig = jest.fn();
    repositoryWorker.renovateRepository = jest.fn();
    platform.initPlatform.mockImplementation(input => input);
  });
  it('handles config warnings and errors', async () => {
    configParser.parseConfigs.mockReturnValueOnce({
      repositories: [],
      maintainYarnLock: true,
      foo: 1,
    });
    await globalWorker.start();
  });
  it('handles zero repos', async () => {
    configParser.parseConfigs.mockReturnValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    await globalWorker.start();
  });
  it('processes repositories', async () => {
    configParser.parseConfigs.mockReturnValueOnce({
      gitAuthor: 'a@b.com',
      enabled: true,
      repositories: ['a', 'b'],
    });
    await globalWorker.start();
    expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(2);
  });
});
