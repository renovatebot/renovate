import { ERROR, WARN } from 'bunyan';
import fs from 'fs-extra';
import { logger, mocked } from '../../../test/util';
import * as _presets from '../../config/presets';
import { CONFIG_PRESETS_INVALID } from '../../constants/error-messages';
import { DockerDatasource } from '../../modules/datasource/docker';
import * as platform from '../../modules/platform';
import * as secrets from '../../util/sanitize';
import * as repositoryWorker from '../repository';
import * as configParser from './config/parse';
import * as limits from './limits';
import * as globalWorker from '.';

jest.mock('../repository');
jest.mock('../../util/fs');
jest.mock('../../config/presets');

jest.mock('fs-extra', () => {
  const realFs = jest.requireActual<typeof fs>('fs-extra');
  return {
    ensureDir: jest.fn(),
    remove: jest.fn(),
    readFile: jest.fn((file: string, options: any) => {
      if (file.endsWith('.wasm.gz')) {
        return realFs.readFile(file, options);
      }
      return undefined;
    }),
    writeFile: jest.fn(),
    outputFile: jest.fn(),
  };
});

// imports are readonly
const presets = mocked(_presets);

const addSecretForSanitizing = jest.spyOn(secrets, 'addSecretForSanitizing');
const parseConfigs = jest.spyOn(configParser, 'parseConfigs');
const initPlatform = jest.spyOn(platform, 'initPlatform');

describe('workers/global/index', () => {
  beforeEach(() => {
    logger.getProblems.mockImplementationOnce(() => []);
    initPlatform.mockImplementation((input) => Promise.resolve(input));
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  it('handles config warnings and errors', async () => {
    parseConfigs.mockResolvedValueOnce({
      repositories: [],
      maintainYarnLock: true,
      foo: 1,
    });
    process.env.AWS_SECRET_ACCESS_KEY = 'key';
    process.env.AWS_SESSION_TOKEN = 'token';
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(addSecretForSanitizing).toHaveBeenCalledTimes(2);
  });

  it('resolves global presets immediately', async () => {
    parseConfigs.mockResolvedValueOnce({
      repositories: [],
      globalExtends: [':pinVersions'],
      hostRules: [{ matchHost: 'github.com', token: 'abc123' }],
    });
    presets.resolveConfigPresets.mockResolvedValueOnce({});
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(presets.resolveConfigPresets).toHaveBeenCalledWith({
      extends: [':pinVersions'],
    });
    expect(parseConfigs).toHaveBeenCalledTimes(1);
  });

  it('throws if global presets could not be resolved', async () => {
    presets.resolveConfigPresets.mockImplementationOnce(() => {
      throw new Error('some-error');
    });
    await expect(
      globalWorker.resolveGlobalExtends(['some-preset']),
    ).rejects.toThrow(CONFIG_PRESETS_INVALID);
    expect(presets.resolveConfigPresets).toHaveBeenCalled();
    expect(parseConfigs).not.toHaveBeenCalled();
  });

  it('handles zero repos', async () => {
    parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).not.toHaveBeenCalled();
  });

  it('handles local', async () => {
    parseConfigs.mockResolvedValueOnce({
      platform: 'local',
    });
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
  });

  it('processes repositories', async () => {
    parseConfigs.mockResolvedValueOnce({
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
    await expect(globalWorker.start()).resolves.toBe(0);
    expect(parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(2);
  });

  it('processes repositories break', async () => {
    const isLimitReached = jest.spyOn(limits, 'isLimitReached');
    isLimitReached.mockReturnValue(true);
    parseConfigs.mockResolvedValueOnce({
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
    expect(parseConfigs).toHaveBeenCalledTimes(1);
    expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(0);
    isLimitReached.mockReset();
  });

  it('exits with non-zero when errors are logged', async () => {
    parseConfigs.mockResolvedValueOnce({
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
    parseConfigs.mockResolvedValueOnce({
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
      parseConfigs.mockResolvedValueOnce({
        repositories: ['a'],
        platform: 'github',
        endpoint: 'https://github.com/',
      });
      await globalWorker.start();
      expect(parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });

    it('gitlab', async () => {
      parseConfigs.mockResolvedValueOnce({
        repositories: [{ repository: 'a' }],
        platform: 'gitlab',
        endpoint: 'https://my.gitlab.com/',
      });
      await globalWorker.start();
      expect(parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('write repositories to file', () => {
    it('successfully write file', async () => {
      parseConfigs.mockResolvedValueOnce({
        repositories: ['myOrg/myRepo'],
        platform: 'github',
        endpoint: 'https://github.com/',
        writeDiscoveredRepos: '/tmp/renovate-output.json',
      });

      expect(await globalWorker.start()).toBe(0);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/tmp/renovate-output.json',
        '["myOrg/myRepo"]',
      );
      expect(parseConfigs).toHaveBeenCalledTimes(1);
      expect(repositoryWorker.renovateRepository).toHaveBeenCalledTimes(0);
    });
  });
});
