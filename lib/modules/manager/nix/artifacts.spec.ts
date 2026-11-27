import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { hostRules } from '~test/host-rules.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  binarySource: 'global',
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
// The token is passed through NIX_CONFIG, so the command is the tokenless one.
const tokenEnv = { NIX_CONFIG: 'extra-access-tokens = github.com=token' };
const lockfileMaintenanceCmd = `nix \
--extra-experimental-features 'nix-command flakes' \
flake update`;
// Under `binarySource=docker` the whole command becomes the single-quoted argument
// of `bash -l -c`, so the manager's own single quotes are POSIX-escaped as '"'"'.
const updateInputCmdInDocker = `nix \
--extra-experimental-features '"'"'nix-command flakes'"'"' \
flake update nixpkgs`;

describe('modules/manager/nix/artifacts', () => {
  beforeEach(() => {
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
    hostRules.add({ matchHost: 'github.com', token: 'token' });

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
    expect(execSnapshots).toMatchObject([
      { cmd: updateInputCmd, options: { env: tokenEnv } },
    ]);
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
    hostRules.add({ matchHost: 'github.com', token: 'x-access-token:token' });

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
    expect(execSnapshots).toMatchObject([
      { cmd: updateInputCmd, options: { env: tokenEnv } },
    ]);
  });

  it('keeps a token with shell metacharacters out of the command', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    // hostRules can be set via a repo's own committed config, not only by a
    // trusted platform admin, so the token itself isn't inherently trusted
    hostRules.add({ matchHost: 'github.com', token: 'x$(id)y' });

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: { ...config, constraints: { python: '3.7' } },
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: updateInputCmd,
        options: {
          env: {
            NIX_CONFIG: 'extra-access-tokens = github.com=x$(id)y',
          },
        },
      },
    ]);
    expect(execSnapshots[0].cmd).not.toContain('x$(id)y');
  });

  it('refuses a token nix config cannot carry', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({ modified: ['flake.lock'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    // A newline opens a second config line: any nix setting, post-build-hook included
    hostRules.add({
      matchHost: 'github.com',
      token: 'tok-secret\npost-build-hook = /tmp/pwned',
    });

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'GitHub token is not expressible in NIX_CONFIG, not passing it to nix',
    );
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
    expect(execSnapshots[0].options?.env).not.toHaveProperty('NIX_CONFIG');
  });

  it('spells the setting the way nix parses it', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({ modified: ['flake.lock'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.add({ matchHost: 'github.com', token: 'tok-secret' });

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    // nix needs the `=` as its own token; `name=value` is a syntax error it exits
    // on, and an expectation copied from the source cannot tell the difference
    const line = execSnapshots[0].options?.env?.NIX_CONFIG;
    expect(line?.split(/\s+/)).toEqual([
      'extra-access-tokens',
      '=',
      'github.com=tok-secret',
    ]);
  });

  it('appends to a NIX_CONFIG the user already set', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({ modified: ['flake.lock'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.add({ matchHost: 'github.com', token: 'tok-secret' });
    vi.stubEnv('NIX_CONFIG', 'cores = 1');

    try {
      await updateArtifacts({
        packageFileName: 'flake.nix',
        updatedDeps: [{ depName: 'nixpkgs' }],
        newPackageFileContent: 'some new content',
        config,
      });
    } finally {
      vi.stubEnv('NIX_CONFIG', undefined);
    }

    expect(execSnapshots[0].options?.env?.NIX_CONFIG).toBe(
      'cores = 1\nextra-access-tokens = github.com=tok-secret',
    );
  });

  it('is not shadowed by an ambient NIX_CONFIG', async () => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      NIX_CONFIG: 'cores = 1',
    });
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({ modified: ['flake.lock'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.add({ matchHost: 'github.com', token: 'tok-secret' });

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    // extraEnv alone would lose to this
    expect(execSnapshots[0].options?.env?.NIX_CONFIG).toContain(
      'extra-access-tokens = github.com=tok-secret',
    );
  });

  it('forwards the token to the docker sidecar by name, not in argv', async () => {
    GlobalConfig.set(dockerAdminConfig);
    fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({ modified: ['flake.lock'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');
    hostRules.add({ matchHost: 'github.com', token: 'tok-secret' });

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: { ...config, constraints: { nix: '2.10.0' } },
    });

    const cmds = execSnapshots.map(({ cmd }) => cmd);
    expect(cmds.some((cmd) => cmd.includes('-e NIX_CONFIG'))).toBe(true);
    // the docker run line is argv on the host, the worst of the old exposure
    expect(cmds.every((cmd) => !cmd.includes('tok-secret'))).toBe(true);
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
        cmd: `docker run --rm --name=renovate_sidecar --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e CI -e CONTAINERBASE_CACHE_DIR -w "/tmp/github/some/repo" ghcr.io/renovatebot/base-image bash -l -c 'install-tool nix 2.10.0 && ${updateInputCmdInDocker}'`,
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

  it('falls back to the extracted nix constraint', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['flake.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

    await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: '{}',
      config: { ...config, extractedConstraints: { nix: '2.10.0' } },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool nix 2.10.0' },
      { cmd: updateInputCmd },
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
        artifactError: { fileName: 'flake.lock', stderr: 'exec error' },
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
        cmd: `docker run --rm --name=renovate_sidecar --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e CI -e CONTAINERBASE_CACHE_DIR -w "/tmp/github/some/repo" ghcr.io/renovatebot/base-image bash -l -c 'install-tool nix 2.10.0 && ${updateInputCmdInDocker}'`,
      },
    ]);
  });
});
