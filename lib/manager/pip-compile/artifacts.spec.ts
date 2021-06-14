import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { StatusResult } from '../../util/git';
import type { UpdateArtifactsConfig } from '../types';
import * as pipCompile from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/host-rules');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const adminConfig: RepoAdminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    setAdminConfig(adminConfig);
    docker.resetPrefetchedImages();
  });

  it('returns if no requirements.txt found', async () => {
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('content' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('content' as any);
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated requirements.txt', async () => {
    fs.readFile.mockResolvedValueOnce('current requirements.txt' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New requirements.txt' as any);
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.7' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode', async () => {
    setAdminConfig(dockerAdminConfig);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current requirements.txt' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });

  it('returns updated requirements.txt when doing lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Current requirements.txt' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New requirements.txt' as any);
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses pipenv version from config', async () => {
    setAdminConfig(dockerAdminConfig);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('new lock' as any);
    expect(
      await pipCompile.updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { pipTools: '1.2.3' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
