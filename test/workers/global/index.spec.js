const globalWorker = require('../../../lib/workers/global');
const repositoryWorker = require('../../../lib/workers/repository');
/** @type any */
const configParser = require('../../../lib/config');
/** @type any */
const platform = require('../../../lib/platform');

jest.mock('../../../lib/platform');

const limits = require('../../../lib/workers/global/limits');

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
      hostRules: [
        {
          hostType: 'docker',
          host: 'docker.io',
          username: 'some-user',
          password: 'some-password',
        },
      ],
    });
    await globalWorker.start();
    expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(2);
  });

  it('processes repositories break', async () => {
    limits.getLimitRemaining = jest.fn(() => 0);
    // limits.getLimitRemaining.mockReturnValueOnce(0);
    configParser.parseConfigs.mockReturnValueOnce({
      gitAuthor: 'a@b.com',
      enabled: true,
      repositories: ['a', 'b'],
      hostRules: [
        {
          hostType: 'docker',
          host: 'docker.io',
          username: 'some-user',
          password: 'some-password',
        },
      ],
    });
    await globalWorker.start();
    expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(0);
  });

  describe('processes platforms', () => {
    it('github', async () => {
      configParser.parseConfigs.mockReturnValueOnce({
        repositories: ['a'],
        platform: 'github',
        endpoint: 'https://github.com/',
      });
      await globalWorker.start();
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
    it('gitlab', async () => {
      configParser.parseConfigs.mockReturnValueOnce({
        repositories: [{ repository: 'a' }],
        platform: 'gitlab',
        endpoint: 'https://my.gitlab.com/',
      });
      await globalWorker.start();
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
  });
});
