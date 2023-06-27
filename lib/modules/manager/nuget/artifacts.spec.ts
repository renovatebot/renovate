import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked, scm } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _hostRules from '../../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import type { Registry } from './types';
import * as util from './util';
import * as nuget from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/git');
jest.mock('./util');

const { getConfiguredRegistries, getDefaultRegistries } = mocked(util);
const hostRules = mocked(_hostRules);

const realFs =
  jest.requireActual<typeof import('../../../util/fs')>('../../../util/fs');

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/nuget/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    getDefaultRegistries.mockReturnValue([]);
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    fs.privateCacheDir.mockImplementation(realFs.privateCacheDir);
    scm.getFileList.mockResolvedValueOnce([]);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('aborts if no lock file found', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({ 'packages.lock.json': null });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('aborts if lock file is unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce(
      'path/with space/packages.lock.json'
    );
    git.getFiles.mockResolvedValueOnce({
      'path/with space/packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'path/with space/packages.lock.json': 'Current packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'path/with space/project.csproj',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: "dotnet restore 'path/with space/project.csproj' --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config",
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('updates lock file', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('does not update lock file when non-proj file is changed', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'otherfile.props',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('does not update lock file when no deps changed', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { dotnet: '7.0.100' } },
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'docker pull ghcr.io/containerbase/sidecar',
      },
      {
        cmd: 'docker ps --filter name=renovate_sidecar -aq',
      },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e NUGET_PACKAGES ' +
          '-e MSBUILDDISABLENODEREUSE ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool dotnet 7.0.100' +
          ' && ' +
          'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config' +
          '"',
        options: {
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            CONTAINERBASE_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { dotnet: '7.0.100' } },
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool dotnet 7.0.100',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            CONTAINERBASE_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            CONTAINERBASE_CACHE_DIR: '/tmp/renovate/cache/containerbase',
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            NUGET_PACKAGES:
              '/tmp/renovate/cache/__renovate-private-cache/nuget/packages',
            MSBUILDDISABLENODEREUSE: '1',
          },
        },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        artifactError: {
          lockFile: 'packages.lock.json',
          stderr: 'not found',
        },
      },
    ]);
    expect(execSnapshots).toBeEmptyArray();
  });

  it('authenticates at registries', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    getConfiguredRegistries.mockResolvedValueOnce([
      {
        name: 'myRegistry',
        url: 'https://my-registry.example.org',
      },
      {
        name: 'myRegistry2',
        url: 'https://my-registry2.example.org',
      },
    ] satisfies Registry[]);
    hostRules.find.mockImplementation((search) => {
      if (search.hostType === 'nuget') {
        if (search.url === 'https://my-registry.example.org') {
          return {
            username: 'some-username',
            password: 'some-password',
          };
        } else {
          return {
            password: 'some-password',
          };
        }
      }
      return {};
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd:
          'dotnet nuget add source https://my-registry.example.org/ --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config ' +
          '--name myRegistry --username some-username --password some-password --store-password-in-clear-text',
      },
      {
        cmd:
          'dotnet nuget add source https://my-registry2.example.org/ --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config ' +
          '--name myRegistry2 --password some-password --store-password-in-clear-text',
      },
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
      },
    ]);
  });

  it('strips protocol version from feed url', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFiles.mockResolvedValueOnce({
      'packages.lock.json': 'Current packages.lock.json',
    });
    fs.getLocalFiles.mockResolvedValueOnce({
      'packages.lock.json': 'New packages.lock.json',
    });
    getConfiguredRegistries.mockResolvedValueOnce([
      {
        name: 'myRegistry',
        url: 'https://my-registry.example.org#protocolVersion=3',
      },
    ] as never);
    hostRules.find.mockImplementationOnce(() => ({}));
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New packages.lock.json',
          path: 'packages.lock.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'dotnet nuget add source https://my-registry.example.org/ --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config --name myRegistry',
      },
      {
        cmd: 'dotnet restore project.csproj --force-evaluate --configfile /tmp/renovate/cache/__renovate-private-cache/nuget/nuget.config',
      },
    ]);
  });
});
