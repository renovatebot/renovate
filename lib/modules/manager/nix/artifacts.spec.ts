import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './index.ts';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { env, fs, git, hostRules, partial } from '~test/util.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/host-rules.ts', () => mockDeep());

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
} satisfies RepoGlobalConfig;

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const updateInputCmd = `nix \
--extra-experimental-features 'nix-command flakes' \
flake update nixpkgs`;
const updateInputTokenCmd = `nix \
--extra-experimental-features 'nix-command flakes' \
--extra-access-tokens github.com=token \
flake update nixpkgs`;
const lockfileMaintenanceCmd = `nix \
--extra-experimental-features 'nix-command flakes' \
flake update`;

describe('modules/manager/nix/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.find.mockReturnValue({ token: undefined });
  });

  it('returns if no flake.lock found', async () => {
    const execSnapshots = mockExecAll();
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [''],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('returns updated flake.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: { ...config, constraints: { python: '3.7' } },
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new flake.lock',
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('adds GitHub token', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.find.mockReturnValueOnce({ token: 'token' });

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: { ...config, constraints: { python: '3.7' } },
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new flake.lock',
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputTokenCmd }]);
  });

  it('trims "x-access-token:" prefix from GitHub token', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.find.mockReturnValueOnce({ token: 'x-access-token:token' });

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: { ...config, constraints: { python: '3.7' } },
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new flake.lock',
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputTokenCmd }]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: '{}',
      config: { ...config, constraints: { nix: '2.10.0' } },
    });

    expect(res).toEqual([
      {
        file: {
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
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
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: '{}',
      config: { ...config, constraints: { nix: '2.10.0' } },
    });

    expect(res).toEqual([
      {
        file: {
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool nix 2.10.0' },
      {
        cmd: updateInputCmd,
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecSequence([new Error('exec error')]);

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: '{}',
      config,
    });

    expect(res).toEqual([
      {
        artifactError: { lockFile: 'flake.lock', stderr: 'exec error' },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('returns updated flake.lock when doing lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: '{}',
      config: lockMaintenanceConfig,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new flake.lock',
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: lockfileMaintenanceCmd }]);
  });

  it('uses nix from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: {
        ...config,
        constraints: { nix: '2.10.0' },
      },
    });

    expect(res).toEqual([
      {
        file: {
          path: 'flake.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
          'bash -l -c "' +
          'install-tool nix 2.10.0 ' +
          '&& ' +
          updateInputCmd +
          '"',
      },
    ]);
  });
});
