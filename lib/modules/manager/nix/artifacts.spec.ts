import type { StatusResult } from 'simple-git';
import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../test/exec-util';
import { env, fs, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

process.env.BUILDPACK = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const updateInputCmd = `nix \
    --extra-experimental-features nix-command \
    --extra-experimental-features flakes \
    flake lock --update-input nixpkgs`;
const lockfileMaintenanceCmd = `nix \
    --extra-experimental-features nix-command \
    --extra-experimental-features flakes \
    flake update`;

describe('modules/manager/nix/artifacts', () => {
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

  it('returns if no flake.lock found', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: [''],
    } as StatusResult);

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: 'some new content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('returns updated flake.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['flake.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.7' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['flake.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { nix: '2.10.0' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool nix 2.10.0 ' +
          '&& ' +
          updateInputCmd +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['flake.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { nix: '2.10.0' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool nix 2.10.0' },
      {
        cmd: updateInputCmd,
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current flake.lock');
    const execSnapshots = mockExecSequence([new Error('exec error')]);

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        artifactError: { lockFile: 'flake.lock', stderr: 'exec error' },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('returns updated flake.lock when doing lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['flake.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New flake.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: lockfileMaintenanceCmd }]);
  });

  it('uses nix from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['flake.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    expect(
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { nix: '2.10.0' },
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool nix 2.10.0 ' +
          '&& ' +
          updateInputCmd +
          '"',
      },
    ]);
  });
});
