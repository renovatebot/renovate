import * as _fsExtra from 'fs-extra';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as docker from '../../../util/exec/docker';
import type { ExtraEnv, Opt } from '../../../util/exec/types';
import type { StatusResult } from '../../../util/git/types';
import { find as _find } from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import {
  addExtraEnvVariable,
  extractEnvironmentVariableName,
  getMatchingHostRule,
} from './artifacts';
import type { PipfileLock } from './types';
import { updateArtifacts } from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { Fixtures } from '~test/fixtures';
import { env, git, partial } from '~test/util';

// mock for cjs require for `@renovatebot/detect-tools`
// https://github.com/vitest-dev/vitest/discussions/3134
vi.hoisted(() => {
  require.cache[require.resolve('fs-extra')] = {
    exports: fixtures.fsExtra(),
  } as never;
});
vi.mock('fs-extra', () => fixtures.fsExtra());
vi.mock('../../../util/exec/env', () => mockDeep());
vi.mock('../../../util/git', () => mockDeep());
vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('../../../util/http', () => mockDeep());
vi.mock('../../datasource', () => mockDeep());

const datasource = vi.mocked(_datasource);
const find = vi.mocked(_find);
const fsExtra = vi.mocked(_fsExtra);

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join(upath.join('/tmp/github/some/repo')),
  cacheDir: upath.join(upath.join('/tmp/renovate/cache')),
  containerbaseDir: upath.join(upath.join('/tmp/renovate/cache/containerbase')),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const pipenvCacheDir = upath.join('/tmp/renovate/cache/others/pipenv');
const pipCacheDir = upath.join('/tmp/renovate/cache/others/pip');
const virtualenvsCacheDir = upath.join(
  '/tmp/renovate/cache/others/virtualenvs',
);

type MockFiles = Record<string, string | string[]>;

function mockFiles(mockFiles: MockFiles): void {
  fsExtra.readFile.mockImplementation(((name: string) => {
    for (const [key, value] of Object.entries(mockFiles)) {
      if (name.endsWith(key)) {
        if (!Array.isArray(value)) {
          return value;
        }

        if (value.length > 1) {
          return value.shift();
        }

        return value[0];
      }
    }
    throw new Error('File not found');
  }) as never);
}

describe('modules/manager/pipenv/artifacts', () => {
  beforeEach(() => {
    Fixtures.reset();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();

    // python
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '3.6.2' },
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
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': JSON.stringify({
        _meta: {
          requires: { python_full_version: '3.7.6' },
        },
      } satisfies PipfileLock),
    });
    const execSnapshots = mockExecAll();

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('gets python full version from Pipfile', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile': Fixtures.get('Pipfile1'),
      '/Pipfile.lock': JSON.stringify({
        _meta: {
          requires: { python_full_version: '3.7.6' },
        },
      } satisfies PipfileLock),
    });

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get('Pipfile1'),
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.6.2' },
      {},
      {
        cmd: 'pipenv lock',
        options: {
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
    ]);
  });

  it('gets python version from Pipfile', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile': Fixtures.get('Pipfile2'),
      '/Pipfile.lock': JSON.stringify({
        _meta: {
          requires: { python_full_version: '3.7.6' },
        },
      } satisfies PipfileLock),
    });

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get('Pipfile2'),
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.6.5' },
      {},
      {
        cmd: 'pipenv lock',
        options: {
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
    ]);
  });

  it('gets full python version from .python-version', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': '{}',
      '/.python-version': '3.7.6',
    });

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some toml',
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.7.6' },
      {},
      {
        cmd: 'pipenv lock',
        options: {
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('gets python stream, from .python-version', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    mockFiles({
      '/Pipfile.lock': '{}',
      '/.python-version': '3.8',
    });
    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some toml',
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.8.5' },
      {},
      {
        cmd: 'pipenv lock',
        options: {
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('handles no constraint', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': 'unparseable pipfile lock',
    });

    const execSnapshots = mockExecAll();

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('returns updated Pipfile.lock', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': ['current pipfile.lock', 'new pipfile.lock'],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '== 3.8.*' } },
      }),
    ).toEqual([
      {
        file: {
          contents: 'new pipfile.lock',
          path: 'Pipfile.lock',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pipenv lock',
        options: {
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    const pipFileLock = JSON.stringify({
      _meta: { requires: { python_version: '3.7' } },
    } satisfies PipfileLock);
    mockFiles({
      '/Pipfile.lock': [pipFileLock, pipFileLock, 'new lock'],
    });

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);

    const pipFileLock = JSON.stringify({
      _meta: { requires: { python_version: '3.6' } },
    } satisfies PipfileLock);
    mockFiles({
      '/Pipfile.lock': [pipFileLock, 'new lock'],
    });

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('defaults to latest if no lock constraints', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fsExtra.stat.mockResolvedValueOnce({} as never);
    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    mockFiles({
      '/Pipfile.lock': ['{}', 'new lock'],
    });

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            PIP_CACHE_DIR: pipCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('catches errors', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': 'Current Pipfile.lock',
    });

    fsExtra.outputFile.mockImplementationOnce((() => {
      throw new Error('not found');
    }) as never);

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

    expect(fsExtra.ensureDir.mock.calls).toEqual([]);
    expect(fsExtra.readFile.mock.calls).toEqual([]);
  });

  it('returns updated Pipenv.lock when doing lockfile maintenance', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);
    fsExtra.remove.mockResolvedValue();

    mockFiles({
      '/Pipfile.lock': ['Current Pipfile.lock', 'New Pipfile.lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

    expect(
      await updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
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
          cwd: upath.join('/tmp/github/some/repo'),
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
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    GlobalConfig.set(dockerAdminConfig);

    const oldLock = JSON.stringify({
      default: { pipenv: { version: '==2020.8.13' } },
    } satisfies PipfileLock);
    mockFiles({
      '/Pipfile.lock': [oldLock, oldLock, 'new lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('uses pipenv version from Pipfile dev packages', async () => {
    GlobalConfig.set(dockerAdminConfig);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    const oldLock = JSON.stringify({
      develop: { pipenv: { version: '==2020.8.13' } },
    } satisfies PipfileLock) as never;
    mockFiles({
      '/Pipfile.lock': [oldLock, oldLock, 'new lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('uses pipenv version from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    fsExtra.stat.mockResolvedValueOnce({} as never);
    fsExtra.ensureDir.mockResolvedValue(undefined as never);

    const oldLock = JSON.stringify({
      default: { pipenv: { version: '==2020.8.13' } },
    } satisfies PipfileLock) as never;
    mockFiles({
      '/Pipfile.lock': [oldLock, 'new lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
          },
        },
      },
    ]);

    expect(fsExtra.ensureDir.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pipenv'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/pip'))],
      [expect.toEndWith(upath.join('/tmp/renovate/cache/others/virtualenvs'))],
    ]);
    expect(fsExtra.readFile.mock.calls).toEqual([
      [expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile')), 'utf8'],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/.python-version')),
        'utf8',
      ],
      [
        expect.toEndWith(upath.join('/tmp/github/some/repo/Pipfile.lock')),
        'utf8',
      ],
    ]);
  });

  it('passes private credential environment vars', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': ['current Pipfile.lock', 'New Pipfile.lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

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
          cwd: upath.join('/tmp/github/some/repo'),
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

  it('returns no host rule on invalid url', () => {
    expect(getMatchingHostRule('')).toBeNull();
  });

  it.each`
    credential                      | result
    ${'$USERNAME'}                  | ${'USERNAME'}
    ${'$'}                          | ${null}
    ${''}                           | ${null}
    ${'${USERNAME}'}                | ${'USERNAME'}
    ${'${USERNAME:-default}'}       | ${'USERNAME'}
    ${'${COMPLEX_NAME_1:-default}'} | ${'COMPLEX_NAME_1'}
  `('extractEnvironmentVariableName($credential)', ({ credential, result }) => {
    expect(extractEnvironmentVariableName(credential)).toEqual(result);
  });

  it('warns about duplicate placeholders with different values', () => {
    const extraEnv: Opt<ExtraEnv> = {
      FOO: '1',
    };
    addExtraEnvVariable(extraEnv, 'FOO', '2');
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('updates extraEnv if variable names differ from default', async () => {
    fsExtra.ensureDir.mockResolvedValue(undefined as never);
    fsExtra.stat.mockResolvedValueOnce({} as never);

    mockFiles({
      '/Pipfile.lock': ['current Pipfile.lock', 'New Pipfile.lock'],
    });

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['Pipfile.lock'],
      }),
    );

    find.mockReturnValueOnce({
      username: 'usernameOne',
      password: 'passwordTwo',
    });

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
          cwd: upath.join('/tmp/github/some/repo'),
          env: {
            PIPENV_CACHE_DIR: pipenvCacheDir,
            WORKON_HOME: virtualenvsCacheDir,
            USERNAME_FOO: 'usernameOne',
            PAZZWORD: 'passwordTwo',
          },
        },
      },
    ]);
  });
});
