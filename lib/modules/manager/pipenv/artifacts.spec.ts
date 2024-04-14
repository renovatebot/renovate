import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import {
  env,
  fs,
  git,
  mocked,
  mockedFunction,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import { find as _find } from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import type { PipfileLockSchema } from './schema';
import { updateArtifacts } from '.';

const datasource = mocked(_datasource);
const find = mockedFunction(_find);

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../../util/http');
jest.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const pipenvCacheDir = '/tmp/renovate/cache/others/pipenv';
const pipCacheDir = '/tmp/renovate/cache/others/pip';
const virtualenvsCacheDir = '/tmp/renovate/cache/others/virtualenvs';

describe('modules/manager/pipenv/artifacts', () => {
  let pipFileLock: PipfileLockSchema;

  beforeEach(() => {
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
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '3.6.5' },
        { version: '3.7.6' },
        { version: '3.8.5' },
        { version: '3.9.1' },
        { version: '3.10.2' },
      ],
    });

    // pipenv
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '2013.5.19' },
        { version: '2013.6.11' },
        { version: '2013.6.12' },
      ],
    });
  });

  it('returns if no Pipfile.lock found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    pipFileLock._meta!.requires!.python_full_version = '3.7.6';
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);
  });

  it('handles no constraint', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('unparseable pipfile lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('unparseable pipfile lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('returns updated Pipfile.lock', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('current pipfile.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '== 3.8.*' } },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock._meta!.requires!.python_version = '3.7';
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    // pipenv
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2023.1.2' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIPENV_CACHE_DIR ' +
          '-e PIP_CACHE_DIR ' +
          '-e WORKON_HOME ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool python 3.7.6' +
          ' && ' +
          'install-tool pipenv 2013.6.12' +
          ' && ' +
          'pipenv lock' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    pipFileLock._meta!.requires!.python_version = '3.6';
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    // pipenv
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2023.1.2' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.6.5' },
      { cmd: 'install-tool pipenv 2013.6.12' },
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('defaults to latest if no lock constraints', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    // pipenv
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2023.1.2' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.10.2' },
      { cmd: 'install-tool pipenv 2013.6.12' },
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('Current Pipfile.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      { artifactError: { lockFile: 'Pipfile.lock', stderr: 'not found' } },
    ]);
  });

  it('returns updated Pipenv.lock when doing lockfile maintenance', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('uses pipenv version from Pipfile', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.default!['pipenv'].version = '==2020.8.13';
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIPENV_CACHE_DIR ' +
          '-e PIP_CACHE_DIR ' +
          '-e WORKON_HOME ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool python 3.10.2' +
          ' && ' +
          'install-tool pipenv 2020.8.13' +
          ' && ' +
          'pipenv lock' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('uses pipenv version from Pipfile dev packages', async () => {
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.develop!['pipenv'].version = '==2020.8.13';
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIPENV_CACHE_DIR ' +
          '-e PIP_CACHE_DIR ' +
          '-e WORKON_HOME ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool python 3.10.2' +
          ' && ' +
          'install-tool pipenv 2020.8.13' +
          ' && ' +
          'pipenv lock' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('uses pipenv version from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    pipFileLock.default!['pipenv'].version = '==2020.8.13';
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(pipFileLock));
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { pipenv: '==2020.1.1' } },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIPENV_CACHE_DIR ' +
          '-e PIP_CACHE_DIR ' +
          '-e WORKON_HOME ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool python 3.10.2' +
          ' && ' +
          'install-tool pipenv 2020.1.1' +
          ' && ' +
          'pipenv lock' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });

  it('passes private credential environment vars', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('current pipfile.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');

    find.mockReturnValueOnce({
      username: 'usernameOne',
      password: 'passwordTwo',
    });

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get('Pipfile6'),
        config: { ...config, constraints: { python: '== 3.8.*' } },
      }),
    ).toEqual([
      {
        file: {
          contents: 'New Pipfile.lock',
          path: 'Pipfile.lock',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
            USERNAME: 'usernameOne',
            PASSWORD: 'passwordTwo',
          },
        },
      },
    ]);
  });

  it('does not pass private credential environment vars if variable names differ from allowed', async () => {
    fs.ensureCacheDir.mockResolvedValueOnce(pipenvCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(pipCacheDir);
    fs.ensureCacheDir.mockResolvedValueOnce(virtualenvsCacheDir);
    fs.readLocalFile.mockResolvedValueOnce('current pipfile.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New Pipfile.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get('Pipfile7'),
        config: { ...config, constraints: { python: '== 3.8.*' } },
      }),
    ).toEqual([
      {
        file: {
          contents: 'New Pipfile.lock',
          path: 'Pipfile.lock',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);
  });
});
