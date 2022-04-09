import { join } from 'upath';
import { envMock, exec, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import * as pipenv from './artifacts';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/http');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('modules/manager/pipenv/artifacts', () => {
  let pipFileLock;
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    GlobalConfig.set(adminConfig);
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
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
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
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce('unparseable pipfile lock');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('unparseable pipfile lock');
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
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce('current pipfile.lock');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');
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
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock._meta.requires.python_version = '3.7';
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce('Current Pipfile.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Pipfile.lock', stderr: 'not found' } },
    ]);
  });

  it('returns updated Pipenv.lock when doing lockfile maintenance', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');
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
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.default.pipenv.version = '==2020.8.13';
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses pipenv version from Pipfile dev packages', async () => {
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.develop.pipenv.version = '==2020.8.13';
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses pipenv version from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.default.pipenv.version = '==2020.8.13';
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { pipenv: '==2020.1.1' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
