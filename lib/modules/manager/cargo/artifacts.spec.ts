import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import * as cargo from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

describe('modules/manager/cargo/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no Cargo.lock found', async () => {
    fs.statLocalFile.mockRejectedValue(new Error('not found!'));
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');

    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('updates Cargo.lock based on the packageName, when given', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'renamedDep1',
        packageName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated workspace Cargo.lock', async () => {
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/one/Cargo.lock not found')
    );
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/Cargo.lock not found')
    );
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);

    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'crates/one/Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock for lockfile maintenance', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      })
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool rust 1.65.0' +
          ' && ' +
          'cargo update --manifest-path Cargo.toml --workspace' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('supports install mode', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      })
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool rust 1.65.0',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
      {
        cmd: 'cargo update --manifest-path Cargo.toml --workspace',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Cargo.lock', stderr: 'not found' } },
    ]);
  });
});
