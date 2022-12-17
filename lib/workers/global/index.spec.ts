import { expect } from '@jest/globals';
import { ERROR, WARN } from 'bunyan';
import * as _fs from 'fs-extra';
import { logger, mocked } from '../../../test/util';
import * as _presets from '../../config/presets';
import { CONFIG_PRESETS_INVALID } from '../../constants/error-messages';
import { DockerDatasource } from '../../modules/datasource/docker';
import * as _platform from '../../modules/platform';
import * as _repositoryWorker from '../repository';
import * as _configParser from './config/parse';
import * as _limits from './limits';
import * as globalWorker from '.';

jest.mock('../repository');
jest.mock('../../util/fs');
jest.mock('../../config/presets');

jest.mock('fs-extra');
const fs = mocked(_fs);

// imports are readonly
const repositoryWorker = _repositoryWorker;
const configParser: jest.Mocked<typeof _configParser> = _configParser as never;
const platform: jest.Mocked<typeof _platform> = _platform as never;
const presets = mocked(_presets);
const limits = _limits;

describe('workers/global/index', () => {
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
    await expect(globalWorker.start()).resolves.toBe(0);
  });

  it('resolves global presets immediately', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      repositories: [],
      globalExtends: [':pinVersions'],
      hostRules: [{ matchHost: 'github.com', token: 'abc123' }],
    });
    presets.resolveConfigPresets.mockResolvedValueOnce({});
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(presets.resolveConfigPresets).toHaveBeenCalledWith({
      extends: [':pinVersions'],
    });
  });

  it('throws if global presets could not be resolved', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      repositories: [],
      globalExtends: [':pinVersions'],
    });
    presets.resolveConfigPresets.mockImplementation(() => {
      throw new Error('some-error');
    });
    await expect(
      globalWorker.resolveGlobalExtends(['some-preset'])
    ).rejects.toThrow(CONFIG_PRESETS_INVALID);
    expect(presets.resolveConfigPresets).toHaveBeenCalled();
  });

  it('handles zero repos', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    await expect(globalWorker.start()).resolves.toBe(0);
  });

  it('processes repositories', async () => {
    configParser.parseConfigs.mockResolvedValueOnce({
      gitAuthor: 'a@b.com',
      enabled: true,
      repositories: ['a', 'b'],
      hostRules: [
        {
          hostType: DockerDatasource.id,
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
          hostType: DockerDatasource.id,
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
    await expect(globalWorker.start()).resolves.not.toBe(0);
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
    await expect(globalWorker.start()).resolves.toBe(0);
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

  describe('write repositories to file', () => {
    it('successfully write file', async () => {
      configParser.parseConfigs.mockResolvedValueOnce({
        repositories: ['myOrg/myRepo'],
        platform: 'github',
        endpoint: 'https://github.com/',
        writeDiscoveredRepos: '/tmp/renovate-output.json',
      });

      expect(await globalWorker.start()).toBe(0);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/tmp/renovate-output.json',
        '["myOrg/myRepo"]'
      );
      expect(configParser.parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(0);
    });
  });
});
