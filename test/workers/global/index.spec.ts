import * as globalWorker from '../../../lib/workers/global';
import * as _repositoryWorker from '../../../lib/workers/repository';
import * as _configParser from '../../../lib/config';
import * as _platform from '../../../lib/platform';
import * as _limits from '../../../lib/workers/global/limits';

jest.mock('../../../lib/workers/repository');

// imports are readonly
const repositoryWorker = _repositoryWorker;
const configParser: jest.Mocked<typeof _configParser> = _configParser as never;
const platform: jest.Mocked<typeof _platform> = _platform as never;
const limits = _limits;

describe('lib/workers/global', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    configParser.parseConfigs = jest.fn();
    platform.initPlatform.mockImplementation(input => Promise.resolve(input));
  });
  it('handles config warnings and errors', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      repositories: [],
      maintainYarnLock: true,
      foo: 1,
    });
    await globalWorker.start();
  });
  it('handles zero repos', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    await globalWorker.start();
  });
  it('processes repositories', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
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
    configParser.parseConfigs.mockResolvedValueOnce({
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
      configParser.parseConfigs.mockResolvedValueOnce({
        repositories: ['a'],
        platform: 'github',
        endpoint: 'https://github.com/',
      });
      await globalWorker.start();
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
    it('gitlab', async () => {
      configParser.parseConfigs.mockResolvedValueOnce({
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
