import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import { StatusResult } from '../../util/git';
import * as pipenv from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/host-rules');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};

const dockerConfig = { ...config, binarySource: BinarySource.Docker };
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('.updateArtifacts()', () => {
  let pipFileLock;
  beforeEach(async () => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    await setUtilConfig(config);
    docker.resetPrefetchedImages();
    pipFileLock = {
      _meta: { requires: {} },
      default: { pipenv: {} },
      develop: { pipenv: {} },
    };
  });

  it('returns if no Pipfile.lock found', async () => {
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    pipFileLock._meta.requires.python_full_version = '3.7.6';
    fs.readFile.mockResolvedValueOnce(JSON.stringify(pipFileLock) as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce(JSON.stringify(pipFileLock) as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('handles no constraint', async () => {
    fs.readFile.mockResolvedValueOnce('unparseable pipfile lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('unparseable pipfile lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Pipfile.lock', async () => {
    fs.readFile.mockResolvedValueOnce('current pipfile.lock' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.7' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig(dockerConfig);
    pipFileLock._meta.requires.python_version = '3.7';
    fs.readFile.mockResolvedValueOnce(JSON.stringify(pipFileLock) as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: dockerConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current Pipfile.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
  it('returns updated Pipenv.lock when doing lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Current Pipfile.lock' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses pipenv version from Pipfile', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig(dockerConfig);
    pipFileLock.default.pipenv.version = '==2020.8.13';
    fs.readFile.mockResolvedValueOnce(JSON.stringify(pipFileLock) as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: dockerConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses pipenv version from Pipfile dev packages', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig(dockerConfig);
    pipFileLock.develop.pipenv.version = '==2020.8.13';
    fs.readFile.mockResolvedValueOnce(JSON.stringify(pipFileLock) as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: dockerConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses pipenv version from config', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig(dockerConfig);
    pipFileLock.default.pipenv.version = '==2020.8.13';
    fs.readFile.mockResolvedValueOnce(JSON.stringify(pipFileLock) as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...dockerConfig, constraints: { pipenv: '==2020.1.1' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
