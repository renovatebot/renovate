import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifactsConfig } from '../types';
import * as pub from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/http');

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/pub/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no pubspec.lock found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current pubspec.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dart pub upgrade',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });

  it('returns updated dart pubspec.lock', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('New pubspec.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pubspec.lock',
          contents: 'New pubspec.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dart pub upgrade',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });

  it('returns updated dart pubspec.lock for lockfile maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('New pubspec.lock');
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pubspec.lock',
          contents: 'New pubspec.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dart pub upgrade',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });

  it('returns updated flutter pubspec.lock', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('New pubspec.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: 'sdk: flutter',
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pubspec.lock',
          contents: 'New pubspec.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'flutter pub upgrade',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });

  it('returns updated flutter pubspec.lock for lockfile maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old pubspec.lock');
    fs.readLocalFile.mockResolvedValueOnce('New pubspec.lock');
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: 'sdk: flutter',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pubspec.lock',
          contents: 'New pubspec.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'flutter pub upgrade',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });
});
