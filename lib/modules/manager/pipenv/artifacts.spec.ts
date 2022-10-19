import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as pipenv from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/http');
jest.mock('../../datasource');

process.env.BUILDPACK = 'true';

const getPkgReleases = mockedFunction(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('modules/manager/pipenv/artifacts', () => {
  // TODO: #7154
  let pipFileLock: any;

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

    // python
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '3.7.6' },
        { version: '3.8.5' },
        { version: '3.9.1' },
        { version: '3.10.2' },
      ],
    });
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
    const execSnapshots = mockExecAll();
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
    const execSnapshots = mockExecAll();
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
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '== 3.8.*' } },
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
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
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

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    pipFileLock._meta.requires.python_full_version = '3.7.6';
    fs.ensureCacheDir.mockResolvedValueOnce(
      '/tmp/renovate/cache/others/pipenv'
    );
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
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
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.7.6' },
      { cmd: 'pip install --user pipenv' },
      { cmd: 'pipenv lock', options: { cwd: '/tmp/github/some/repo' } },
    ]);
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
    const execSnapshots = mockExecAll();
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
    const execSnapshots = mockExecAll();
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
    const execSnapshots = mockExecAll();
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
    const execSnapshots = mockExecAll();
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
