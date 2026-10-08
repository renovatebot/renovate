import { codeBlock } from 'common-tags';
import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import { simpleGit } from 'simple-git';
import tmp from 'tmp-promise';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import type { RepoGlobalConfig } from '../../config/types.ts';
import { CONFIG_VALIDATION } from '../../constants/error-messages.ts';
import * as memCache from '../cache/memory/index.ts';
import { setUserEnv } from '../env.ts';
import * as _auth from './auth.ts';
import { addGitConfigEnvironmentVariables } from './config.ts';
import * as git from './index.ts';
import { isGitLfsError } from './lfs.ts';
import { getLfsState } from './lfs-state.ts';
import type { StorageConfig } from './types.ts';

vi.mock('timers/promises');
vi.mock('../cache/repository/index.ts');
vi.mock('./auth.ts');
vi.unmock('./index.ts');

const auth = vi.mocked(_auth);

// Class is no longer exported
const SimpleGit = simpleGit().constructor as {
  prototype: ReturnType<typeof simpleGit>;
};
const originalRaw = SimpleGit.prototype.raw;

function oid(n: number): string {
  return n.toString(16).padStart(64, '0');
}

const pointer = codeBlock`
  version https://git-lfs.github.com/spec/v1
  oid sha256:${oid(1)}
  size 20
`;

const authEntry = {
  key: 'url.https://token@example.com/.insteadOf',
  value: 'https://example.com/',
};

function lsFiles(count: number, downloaded = true): string {
  return JSON.stringify({
    files: Array.from({ length: count }, (_, i) => ({
      name: `f${i}.bin`,
      size: 10,
      downloaded,
      oid: oid(i + 1),
    })),
  });
}

function getConfigValues(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  const count = parseInt(env.GIT_CONFIG_COUNT ?? '0', 10);
  for (let i = 0; i < count; i++) {
    result[env[`GIT_CONFIG_KEY_${i}`]] = env[`GIT_CONFIG_VALUE_${i}`];
  }
  return result;
}

function getConfigKeys(env: Record<string, string>): string[] {
  return Object.keys(getConfigValues(env));
}

async function createOrigin(
  files: Record<string, string>,
): Promise<tmp.DirectoryResult> {
  const work = await tmp.dir({ unsafeCleanup: true });
  const repo = simpleGit(work.path);
  await repo.init(['--initial-branch=main']);
  await repo.addConfig('user.email', 'Jest@example.com');
  await repo.addConfig('user.name', 'Jest');
  await repo.addConfig('commit.gpgsign', 'false');
  for (const [name, content] of Object.entries(files)) {
    await fs.outputFile(`${work.path}/${name}`, content);
  }
  await repo.add('.');
  await repo.commit('init');
  const origin = await tmp.dir({ unsafeCleanup: true });
  await simpleGit(origin.path).clone(work.path, '.', ['--bare']);
  await work.cleanup();
  return origin;
}

describe('util/git/index-lfs', { timeout: 30000 }, () => {
  let origin: tmp.DirectoryResult | undefined;
  let tmpDir: tmp.DirectoryResult | undefined;
  const stub = vi.fn<(args: string[]) => Promise<string> | undefined>();
  const lfs = vi.fn<(args: string[]) => Promise<string>>();

  async function setup(
    globalConfig: RepoGlobalConfig,
    files: Record<string, string> = { 'README.md': 'hi\n' },
    storageConfig: Partial<StorageConfig> = {},
  ): Promise<void> {
    origin = await createOrigin(files);
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    GlobalConfig.set({ localDir: tmpDir.path, ...globalConfig });
    await git.initRepo({ url: origin.path, ...storageConfig });
    git.setUserRepoConfig({});
  }

  async function setupAndClone(
    globalConfig: RepoGlobalConfig,
    files?: Record<string, string>,
  ): Promise<void> {
    await setup(globalConfig, files);
    await git.syncGit();
    const local = simpleGit(tmpDir!.path);
    await local.addConfig('commit.gpgsign', 'false');
    await local.addConfig('user.name', 'Jest');
    await local.addConfig('user.email', 'Jest@example.com');
  }

  function commitConfig(
    path = 'new.txt',
  ): Parameters<typeof git.prepareCommit>[0] {
    return {
      branchName: 'renovate/lfs',
      files: [{ type: 'addition', path, contents: 'new content' }],
      message: 'update',
    };
  }

  beforeEach(() => {
    // oxlint-disable-next-line prefer-arrow-callback -- delegates to the original with the simple-git instance as `this`
    vi.spyOn(SimpleGit.prototype, 'raw').mockImplementation(function (
      this: SimpleGit,
      ...args: any[]
    ) {
      const cmd: string[] = Array.isArray(args[0]) ? args[0] : args;
      if (cmd[0] === 'lfs') {
        return lfs(cmd) as any;
      }
      return (stub(cmd) ?? originalRaw.apply(this, args as any)) as any;
    });
    lfs.mockResolvedValue('');
    auth.getGitEnvironmentVariables.mockImplementation((env) =>
      addGitConfigEnvironmentVariables({ ...env, GIT_ALLOW_PROTOCOL: 'file' }, [
        authEntry,
      ]),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    memCache.reset();
    GlobalConfig.reset();
    await tmpDir?.cleanup();
    await origin?.cleanup();
    tmpDir = undefined;
    origin = undefined;
  });

  describe('initRepo()', () => {
    beforeEach(async () => {
      tmpDir = await tmp.dir({ unsafeCleanup: true });
      stub.mockImplementation((cmd) =>
        cmd[0] === 'ls-remote' ? Promise.resolve('') : undefined,
      );
    });

    it('passes the pinned LFS config for https remotes', async () => {
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');
      GlobalConfig.set({ localDir: tmpDir!.path, gitLfs: 'upload' });

      await git.initRepo({
        url: 'https://x-access-token:T@github.com/o/r.git',
      });

      expect(getLfsState()).toEqual({
        mode: 'upload',
        active: true,
        endpoint: 'https://github.com/o/r.git/info/lfs',
        authEndpoint: 'https://x-access-token:T@github.com/o/r.git/info/lfs',
        include: [],
        authenticated: false,
      });
      const env = envSpy.mock.lastCall![0] as Record<string, string>;
      expect(getConfigValues(env)).toMatchObject({
        'lfs.url': 'https://x-access-token:T@github.com/o/r.git/info/lfs',
        'lfs.pushurl': 'https://x-access-token:T@github.com/o/r.git/info/lfs',
        'core.hooksPath': '/dev/null',
      });
      expect(env).toMatchObject({ GIT_LFS_SKIP_SMUDGE: '1' });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'gitLfs: mode=upload active=true endpointHost=github.com',
      );
    });

    it('is inactive in fork mode', async () => {
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');
      GlobalConfig.set({ localDir: tmpDir!.path, gitLfs: 'enabled' });

      await git.initRepo({
        url: 'https://github.com/fork/r.git',
        upstreamUrl: 'https://github.com/o/r.git',
      });

      expect(getLfsState()).toMatchObject({
        mode: 'enabled',
        active: false,
        inactiveReason: 'fork',
      });
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        'Git LFS support is not available in fork mode',
      );
      expect(
        getConfigKeys(envSpy.mock.lastCall![0] as Record<string, string>),
      ).not.toContain('lfs.url');
    });

    it('is inactive for ssh remotes', async () => {
      GlobalConfig.set({ localDir: tmpDir!.path, gitLfs: 'upload' });

      await git.initRepo({ url: 'git@github.com:o/r.git' });

      expect(getLfsState()).toMatchObject({
        active: false,
        inactiveReason: 'ssh',
      });
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        'Git LFS support is not available for SSH remotes yet; LFS-tracked files will be committed as regular Git files',
      );
    });

    it('removes GIT_CONFIG_* and GIT_CONFIG_PARAMETERS from the repository env', async () => {
      memCache.init();
      setUserEnv({
        GIT_CONFIG_PARAMETERS: "'lfs.pushurl'='file:///victim'",
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'lfs.pushurl',
        GIT_CONFIG_VALUE_0: 'file:///victim',
      });
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');
      GlobalConfig.set({ localDir: tmpDir!.path, gitLfs: 'upload' });

      await git.initRepo({ url: 'https://github.com/o/r.git' });

      const env = envSpy.mock.lastCall![0] as Record<string, string>;
      expect(env.GIT_CONFIG_PARAMETERS).toBeUndefined();
      expect(env.GIT_CONFIG_KEY_0).toBe('filter.lfs.clean');
      expect(getConfigValues(env)['lfs.pushurl']).toBe(
        'https://github.com/o/r.git/info/lfs',
      );
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        'Ignoring GIT_CONFIG_* from repository env because gitLfs is enabled',
      );
    });
  });

  describe('syncGit()', () => {
    it('stays active without .lfsconfig', async () => {
      await setupAndClone({ gitLfs: 'upload' });

      expect(getLfsState().active).toBeTrue();
      await expect(git.getRepoStatus()).resolves.toMatchObject({
        files: [],
      });
    });

    it('stays active when .lfsconfig sets no endpoint', async () => {
      await setupAndClone(
        { gitLfs: 'upload' },
        { '.lfsconfig': `[lfs]\n\tfetchinclude = *\n` },
      );

      expect(getLfsState().active).toBeTrue();
    });

    it('becomes inactive when .lfsconfig points to another server', async () => {
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');

      await setupAndClone(
        { gitLfs: 'upload' },
        {
          '.lfsconfig': `[lfs]\n\turl = https://user:pass@evil.example.com/lfs\n`,
        },
      );

      expect(getLfsState()).toMatchObject({
        active: false,
        inactiveReason: 'external-lfs-server',
      });
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { host: 'evil.example.com' },
        "Git LFS support is inactive for this repository because .lfsconfig points to a different LFS server. Renovate only uploads to the repository's own LFS storage",
      );
      const env = envSpy.mock.lastCall![0] as Record<string, string>;
      expect(env.GIT_CONFIG_COUNT).toBeUndefined();
      expect(env.GIT_LFS_SKIP_SMUDGE).toBeUndefined();

      await git.prepareCommit(commitConfig());

      expect(lfs).not.toHaveBeenCalled();
    });

    it('drops the unsafe options of the LFS config when it becomes inactive', async () => {
      await setupAndClone(
        { gitLfs: 'upload' },
        { '.lfsconfig': `[lfs]\n\turl = https://evil.example.com/lfs\n` },
      );
      memCache.init();
      setUserEnv({
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.hooksPath',
        GIT_CONFIG_VALUE_0: 'hooks',
      });
      stub.mockImplementation((cmd) =>
        cmd[0] === 'config' && cmd[1] === '--file'
          ? Promise.resolve('submodule.sub.path sub\n')
          : undefined,
      );

      await git.cloneSubmodules(true, undefined);

      expect(getLfsState().active).toBeFalse();
      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          err: expect.objectContaining({
            message: expect.stringContaining('allowUnsafeHooksPath'),
          }),
          submodule: 'sub',
        },
        'Unable to initialise git submodule',
      );
    });

    it('keeps an .lfsconfig with the own endpoint active', async () => {
      const work = await tmp.dir({ unsafeCleanup: true });
      origin = await tmp.dir({ unsafeCleanup: true });
      const repo = simpleGit(work.path);
      await repo.init(['--initial-branch=main']);
      await repo.addConfig('user.email', 'Jest@example.com');
      await repo.addConfig('user.name', 'Jest');
      await repo.addConfig('commit.gpgsign', 'false');
      await fs.outputFile(
        `${work.path}/.lfsconfig`,
        `[lfs]\n\turl = file://${origin.path}/\n`,
      );
      await repo.add('.');
      await repo.commit('init');
      await simpleGit(origin.path).clone(work.path, '.', ['--bare']);
      await work.cleanup();
      tmpDir = await tmp.dir({ unsafeCleanup: true });
      GlobalConfig.set({ localDir: tmpDir.path, gitLfs: 'upload' });
      await git.initRepo({ url: origin.path });

      await git.syncGit();

      expect(getLfsState().active).toBeTrue();
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });
  });

  describe('prepareCommit()', () => {
    it('uploads the new LFS objects in chunks', async () => {
      await setupAndClone({ gitLfs: 'upload' });
      lfs.mockImplementation((args) =>
        Promise.resolve(args[1] === 'ls-files' ? lsFiles(150) : ''),
      );

      const result = await git.prepareCommit(commitConfig());

      expect(result).not.toBeNull();
      expect(lfs).toHaveBeenNthCalledWith(1, [
        'lfs',
        'ls-files',
        '--json',
        result!.parentCommitSha,
        result!.commitSha,
      ]);
      const pushes = lfs.mock.calls
        .map(([args]) => args)
        .filter((args) => args[1] === 'push');
      expect(pushes).toHaveLength(2);
      expect(pushes[0].slice(0, 4)).toEqual([
        'lfs',
        'push',
        '--object-id',
        'origin',
      ]);
      expect(pushes[0]).toHaveLength(104);
      expect(pushes[1]).toHaveLength(54);
      expect(pushes[1].at(-1)).toBe(oid(150));
    });

    it('skips the upload without local objects', async () => {
      await setupAndClone({ gitLfs: 'upload' });
      lfs.mockImplementation((args) =>
        Promise.resolve(args[1] === 'ls-files' ? lsFiles(2, false) : ''),
      );

      await git.prepareCommit(commitConfig());

      expect(lfs).toHaveBeenCalledOnce();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { branchName: 'renovate/lfs', skipped: ['f0.bin', 'f1.bin'] },
        'gitLfs: skipping LFS pointers without a local object',
      );
    });

    it('does not push when nothing is listed', async () => {
      await setupAndClone({ gitLfs: 'upload' });
      lfs.mockResolvedValue('{"files":[]}');

      await git.prepareCommit(commitConfig());

      expect(lfs).toHaveBeenCalledOnce();
    });

    it('never runs git-lfs when disabled', async () => {
      await setupAndClone({});

      await git.prepareCommit(commitConfig());

      expect(lfs).not.toHaveBeenCalled();
    });

    it('throws upload errors even for rejected workflow changes', async () => {
      await setupAndClone({ gitLfs: 'upload' });
      lfs.mockImplementation((args) =>
        args[1] === 'ls-files'
          ? Promise.resolve(lsFiles(1))
          : Promise.reject(
              new Error(
                'error: The requested URL returned error: 403 for https://x:SECRET@github.com',
              ),
            ),
      );
      const pushSpy = vi.spyOn(SimpleGit.prototype, 'push');
      const config = commitConfig('.github/workflows/x.yml');

      const err = await git.prepareCommit(config).catch((e) => e);
      expect(err).toMatchObject({
        message:
          'git-lfs push failed: error: The requested URL returned error: 403 for https://***@github.com',
      });
      expect(isGitLfsError(err)).toBeTrue();
      await expect(git.commitFiles(config)).rejects.toThrow(
        'git-lfs push failed',
      );
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  describe('getFile()', () => {
    const files = { 'lock.json': `${pointer}\n`, 'README.md': 'hi\n' };

    beforeEach(() => {
      stub.mockImplementation((cmd) =>
        cmd[0] === 'cat-file' ? Promise.resolve('{"real":true}') : undefined,
      );
    });

    it('resolves pointers matching gitLfsInclude', async () => {
      await setupAndClone({ gitLfs: 'enabled' }, files);
      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      await expect(git.getFile('lock.json')).resolves.toBe('{"real":true}');
      await expect(git.getFile('README.md')).resolves.toBe('hi\n');

      expect(
        stub.mock.calls.filter(([args]) => args[0] === 'cat-file'),
      ).toEqual([[['cat-file', '--filters', 'origin/main:lock.json']]]);
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('returns the pointer in upload mode', async () => {
      await setupAndClone({ gitLfs: 'upload' }, files);

      await expect(git.getFile('lock.json')).resolves.toBe(`${pointer}\n`);

      expect(stub).not.toHaveBeenCalledWith(
        expect.arrayContaining(['cat-file']),
      );
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { fileName: 'lock.json' },
        'File is stored in Git LFS and Renovate read its LFS pointer instead of the content. See the `gitLfs` documentation.',
      );
    });

    it('throws download errors', async () => {
      await setupAndClone({ gitLfs: 'enabled' }, files);
      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });
      stub.mockImplementation((cmd) =>
        cmd[0] === 'cat-file'
          ? Promise.reject(new Error('Error downloading object: lock.json'))
          : undefined,
      );

      await expect(git.getFile('lock.json')).rejects.toMatchObject({
        message: CONFIG_VALIDATION,
        validationSource: 'gitLfsInclude',
        validationError: 'Git LFS download failed',
      });
    });
  });

  describe('initGitLfs()', () => {
    it('does nothing when inactive', async () => {
      await setupAndClone({});

      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      expect(lfs).not.toHaveBeenCalled();
    });

    it('ignores gitLfsInclude in upload mode', async () => {
      await setupAndClone({ gitLfs: 'upload' });

      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      expect(lfs).not.toHaveBeenCalled();
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        'gitLfsInclude is ignored because gitLfs is set to "upload"',
      );
    });

    it('does nothing with an empty include', async () => {
      await setupAndClone({ gitLfs: 'enabled' });

      await git.initGitLfs({});

      expect(lfs).not.toHaveBeenCalled();
    });

    it('switches to selective smudge and pulls', async () => {
      await setupAndClone({ gitLfs: 'enabled' });
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');
      lfs.mockImplementation((args) =>
        Promise.resolve(
          args[1] === 'ls-files'
            ? JSON.stringify({
                files: [
                  { name: 'a', size: 1048576, downloaded: true, oid: oid(1) },
                  { name: 'b', size: 5, downloaded: false, oid: oid(2) },
                ],
              })
            : '',
        ),
      );

      await git.initGitLfs({
        gitLfsInclude: ['package-lock.json', '.yarn/cache/**'],
      });

      const env = envSpy.mock.lastCall![0] as Record<string, string>;
      expect(getConfigValues(env)).toMatchObject({
        'lfs.fetchinclude': 'package-lock.json,.yarn/cache/**',
        'lfs.fetchexclude': '',
        'filter.lfs.smudge': 'git-lfs smudge -- %f',
      });
      expect(env.GIT_LFS_SKIP_SMUDGE).toBe('0');
      expect(getConfigKeys(env)).not.toContain(authEntry.key);
      expect(lfs.mock.calls).toEqual([
        [['lfs', 'pull']],
        [['lfs', 'ls-files', '--json']],
      ]);
      expect(lfs.mock.invocationCallOrder[0]).toBeGreaterThan(
        envSpy.mock.invocationCallOrder.at(-1)!,
      );
      expect(logger.logger.info).toHaveBeenCalledWith(
        'Git LFS: materialized 1 file(s) (1.0 MiB) matching gitLfsInclude',
      );
    });

    it('does not pick up the repository env', async () => {
      await setupAndClone({ gitLfs: 'enabled' });
      memCache.init();
      setUserEnv({
        GIT_SSL_NO_VERIFY: '1',
        HTTPS_PROXY: 'http://attacker:8080',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'lfs.pushurl',
        GIT_CONFIG_VALUE_0: 'file:///victim',
      });
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');

      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      const env = envSpy.mock.lastCall![0] as Record<string, string>;
      expect(env.GIT_SSL_NO_VERIFY).toBeUndefined();
      expect(env.HTTPS_PROXY).toBeUndefined();
      expect(getConfigValues(env)).toMatchObject({
        'lfs.pushurl': `file://${origin!.path}`,
        'lfs.fetchinclude': 'lock.json',
      });
    });

    it('throws a config error when the pull fails', async () => {
      await setupAndClone({ gitLfs: 'enabled' });
      lfs.mockRejectedValue(new Error('Error downloading object'));

      const err = await git
        .initGitLfs({ gitLfsInclude: ['lock.json'] })
        .catch((e) => e);
      expect(err).toMatchObject({
        message: CONFIG_VALIDATION,
        validationSource: 'gitLfsInclude',
      });
      expect(isGitLfsError(err)).toBeTrue();
    });

    it('does not pull when the .lfsconfig check deactivates LFS', async () => {
      await setup(
        { gitLfs: 'enabled' },
        { '.lfsconfig': `[lfs]\n\tpushurl = https://evil.example.com/lfs\n` },
      );

      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      expect(getLfsState().active).toBeFalse();
      expect(lfs).not.toHaveBeenCalled();
    });
  });

  describe('cloneSubmodules()', () => {
    beforeEach(() => {
      stub.mockImplementation((cmd) =>
        cmd[0] === 'config' && cmd[1] === '--file'
          ? Promise.resolve('submodule.sub.path sub\n')
          : undefined,
      );
    });

    it('keeps the LFS config after the auth entries', async () => {
      await setupAndClone({ gitLfs: 'enabled' });
      const envSpy = vi.spyOn(SimpleGit.prototype, 'env');
      const submoduleSpy = vi
        .spyOn(SimpleGit.prototype, 'submoduleUpdate')
        .mockResolvedValue('');

      await git.cloneSubmodules(true, undefined);

      expect(submoduleSpy).toHaveBeenCalledOnce();
      const keys = getConfigKeys(
        envSpy.mock.lastCall![0] as Record<string, string>,
      );
      expect(keys.indexOf(authEntry.key)).toBeGreaterThanOrEqual(0);
      expect(keys.indexOf('filter.lfs.clean')).toBeGreaterThan(
        keys.indexOf(authEntry.key),
      );
      expect(keys.at(-1)).toBe('lfs.fetchexclude');
      expect(getLfsState().authenticated).toBeTrue();

      await git.initGitLfs({ gitLfsInclude: ['lock.json'] });

      expect(
        getConfigKeys(envSpy.mock.lastCall![0] as Record<string, string>),
      ).toContain(authEntry.key);
    });

    it('does not mark the env authenticated without matching submodules', async () => {
      await setupAndClone({ gitLfs: 'enabled' });

      await git.cloneSubmodules(true, ['other']);

      expect(getLfsState().authenticated).toBeFalse();
    });
  });

  describe('validateGitLfs()', () => {
    it('accepts a valid version', async () => {
      lfs.mockResolvedValue('git-lfs/3.8.0 (GitHub; linux amd64; go 1.24.4)');

      await expect(git.validateGitLfs('enabled')).resolves.toEqual({
        ok: true,
        version: '3.8.0',
      });

      expect(lfs).toHaveBeenCalledWith(['lfs', 'version']);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Found git-lfs version 3.8.0',
      );
    });

    it('rejects an old version', async () => {
      lfs.mockResolvedValue('git-lfs/3.4.1 (GitHub; linux amd64; go 1.21)');

      await expect(git.validateGitLfs('enabled')).resolves.toEqual({
        ok: false,
        version: '3.4.1',
      });

      expect(logger.logger.error).toHaveBeenCalledWith(
        { detectedVersion: '3.4.1', mode: 'enabled' },
        'git-lfs is missing or its version needs upgrading',
      );
    });

    it('rejects a missing git-lfs', async () => {
      lfs.mockRejectedValue(new Error("git: 'lfs' is not a git command"));

      await expect(git.validateGitLfs('upload')).resolves.toEqual({
        ok: false,
        version: null,
      });
    });
  });
});
