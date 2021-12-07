import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { StatusResult } from '../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import * as pipCompile from './artifacts';
import * as fsutil from '../../util/fs';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/host-rules');
jest.mock('../../util/http');
jest.mock('../../util/fs', () => {
  const originalModule = jest.requireActual('../../util/fs');

  return {
    __esModule: true,
    ...originalModule,
    readLocalFile: jest.fn(),
  };
});

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const readLocalFile = mocked(fsutil.readLocalFile);

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('manager/pip-compile/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
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
    readLocalFile.mockResolvedValueOnce('content' as any);
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockReturnValueOnce('content' as any);
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
    readLocalFile.mockResolvedValueOnce('current requirements.txt' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    readLocalFile.mockReturnValueOnce('New requirements.txt' as any);
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
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    readLocalFile.mockReturnValueOnce('new lock' as any);
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
    readLocalFile.mockResolvedValueOnce('Current requirements.txt' as any);
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
    ).toEqual([
      {
        artifactError: { lockFile: 'requirements.txt', stderr: 'not found' },
      },
    ]);
  });

  it('returns updated requirements.txt when doing lockfile maintenance', async () => {
    readLocalFile.mockResolvedValueOnce('Current requirements.txt' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    readLocalFile.mockReturnValueOnce('New requirements.txt' as any);
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
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    readLocalFile.mockReturnValueOnce('new lock' as any);
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
