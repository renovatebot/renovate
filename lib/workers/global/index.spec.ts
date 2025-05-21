import { ERROR, WARN } from 'bunyan';
import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { DockerDatasource } from '../../modules/datasource/docker';
import * as platform from '../../modules/platform';
import * as secrets from '../../util/sanitize';
import * as repositoryWorker from '../repository';
import * as configParser from './config/parse';
import * as limits from './limits';
import * as globalWorker from '.';
import { logger } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../repository');
vi.mock('../../util/fs');

vi.mock('fs-extra', async () => {
  const realFs = await vi.importActual<typeof fs>('fs-extra');
  return {
    default: {
      ensureDir: vi.fn(),
      remove: vi.fn(),
      readFile: vi.fn((file: string, options: any) => {
        if (file.endsWith('.wasm.gz')) {
          return realFs.readFile(file, options);
        }
        return undefined;
      }),
      writeFile: vi.fn(),
      outputFile: vi.fn(),
    },
  };
});

// TODO: why do we need git here?
vi.unmock('../../util/git');

const addSecretForSanitizing = vi.spyOn(secrets, 'addSecretForSanitizing');
const parseConfigs = vi.spyOn(configParser, 'parseConfigs');
const initPlatform = vi.spyOn(platform, 'initPlatform');

describe('workers/global/index', () => {
  beforeEach(() => {
    logger.getProblems.mockImplementation(() => []);
    logger.logLevel.mockImplementation(() => 'info');
    initPlatform.mockImplementation((input) => Promise.resolve(input));
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  describe('getRepositoryConfig', () => {
    const globalConfig: RenovateConfig = { baseDir: '/tmp/base' };

    GlobalConfig.set({ platform: 'gitlab' });

    it('should generate correct topLevelOrg/parentOrg with multiple levels', async () => {
      const repository = 'a/b/c/d';
      const repoConfig = await globalWorker.getRepositoryConfig(
        globalConfig,
        repository,
      );
      expect(repoConfig.topLevelOrg).toBe('a');
      expect(repoConfig.parentOrg).toBe('a/b/c');
      expect(repoConfig.repository).toBe('a/b/c/d');
    });

    it('should generate correct topLevelOrg/parentOrg with two levels', async () => {
      const repository = 'a/b';
      const repoConfig = await globalWorker.getRepositoryConfig(
        globalConfig,
        repository,
      );
      expect(repoConfig.topLevelOrg).toBe('a');
      expect(repoConfig.parentOrg).toBe('a');
      expect(repoConfig.repository).toBe('a/b');
    });
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
    const isLimitReached = vi.spyOn(limits, 'isLimitReached');
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
    logger.getProblems.mockImplementation(() => [
      {
        level: ERROR,
        msg: 'meh',
      },
    ]);
    await expect(globalWorker.start()).resolves.not.toBe(0);
  });

  it('exits with zero when warnings are logged', async () => {
    delete process.env.LOG_LEVEL;
    parseConfigs.mockResolvedValueOnce({
      baseDir: '/tmp/base',
      cacheDir: '/tmp/cache',
      repositories: [],
    });
    logger.getProblems.mockReset();
    logger.getProblems.mockImplementation(() => [
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
