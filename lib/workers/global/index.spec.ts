import { ERROR, WARN } from 'bunyan';
import { getName, logger } from '../../../test/util';
import * as _configParser from '../../config';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import * as datasourceDocker from '../../datasource/docker';
import * as _platform from '../../platform';
import * as _repositoryWorker from '../repository';
import * as _limits from './limits';
import * as globalWorker from '.';

jest.mock('../repository');

// imports are readonly
const repositoryWorker = _repositoryWorker;
const configParser: jest.Mocked<typeof _configParser> = _configParser as never;
const platform: jest.Mocked<typeof _platform> = _platform as never;
const limits = _limits;

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    logger.getProblems.mockImplementationOnce(() => []);
    configParser.parseConfigs = jest.fn();
    platform.initPlatform.mockImplementation((input) => Promise.resolve(input));
  });
  it('handles config warnings and errors', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      repositories: [],
      maintainYarnLock: true,
      foo: 1,
    });
    await expect(globalWorker.start()).resolves.toEqual(0);
  });
  it('handles zero repos', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    await expect(globalWorker.start()).resolves.toEqual(0);
  });
  it('processes repositories', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      gitAuthor: 'a@b.com',
      enabled: true,
      repositories: ['a', 'b'],
      hostRules: [
        {
          hostType: datasourceDocker.id,
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
    limits.isLimitReached = jest.fn(() => true);
    configParser.parseConfigs.mockResolvedValueOnce({
      gitAuthor: 'a@b.com',
      enabled: true,
      repositories: ['a', 'b'],
      hostRules: [
        {
          hostType: datasourceDocker.id,
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
  it('exits with non-zero when errors are logged', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    logger.getProblems.mockReset();
    logger.getProblems.mockImplementationOnce(() => [
      {
        level: ERROR,
        msg: 'meh',
      },
    ]);
    await expect(globalWorker.start()).resolves.not.toEqual(0);
  });
  it('exits with zero when warnings are logged', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    logger.getProblems.mockReset();
    logger.getProblems.mockImplementationOnce(() => [
      {
        level: WARN,
        msg: 'meh',
      },
    ]);
    await expect(globalWorker.start()).resolves.toEqual(0);
  });
  describe('processes platforms', () => {
    it('github', async () => {
      configParser.parseConfigs.mockResolvedValueOnce({
        repositories: ['a'],
        platform: PLATFORM_TYPE_GITHUB,
        endpoint: 'https://github.com/',
      });
      await globalWorker.start();
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
    it('gitlab', async () => {
      configParser.parseConfigs.mockResolvedValueOnce({
        repositories: [{ repository: 'a' }],
        platform: PLATFORM_TYPE_GITLAB,
        endpoint: 'https://my.gitlab.com/',
      });
      await globalWorker.start();
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
  });
});
