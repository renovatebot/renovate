import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import semver from 'semver';
import tmp from 'tmp-promise';
import upath from 'upath';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import type { RepoGlobalConfig } from '../../config/types.ts';
import * as memCache from '../cache/memory/index.ts';
import { setCustomEnv, setUserEnv } from '../env.ts';
import { readLocalFile } from '../fs/index.ts';
import * as git from './index.ts';
import {
  GIT_LFS_MIN_VERSION,
  LFS_POINTER_VERSION,
  parseGitLfsVersion,
  parseLfsPointer,
} from './lfs.ts';
import { getLfsState } from './lfs-state.ts';

vi.mock('timers/promises');
vi.mock('../cache/repository/index.ts');
vi.unmock('./index.ts');

const execFileAsync = promisify(execFile);

const lfsVersion = await execFileAsync('git-lfs', ['version']).then(
  ({ stdout }) => parseGitLfsVersion(stdout),
  () => null,
);
// `core.hooksPath=/dev/null` is untested on Windows
const isPosix = process.platform !== 'win32';
const hasGitLfsUpload =
  isPosix && !!lfsVersion && semver.gte(lfsVersion, GIT_LFS_MIN_VERSION.upload);
const hasGitLfsEnabled =
  hasGitLfsUpload && semver.gte(lfsVersion, GIT_LFS_MIN_VERSION.enabled);

const gitAuthor = 'Renovate <renovate@example.com>';

const gitattributes =
  '*.bin filter=lfs diff=lfs merge=lfs -text\npackage-lock.json filter=lfs diff=lfs merge=lfs -text\n';

const lock = '{"lockfileVersion":3}\n';
const otherLock = '{"lockfileVersion":3,"other":true}\n';

// Full LFS filters for the fixture repositories, Renovate's own calls never get these
const fullFilters = [
  '-c',
  'filter.lfs.process=git-lfs filter-process',
  '-c',
  'filter.lfs.clean=git-lfs clean -- %f',
  '-c',
  'filter.lfs.smudge=git-lfs smudge -- %f',
  '-c',
  'filter.lfs.required=true',
  '-c',
  'core.hooksPath=/dev/null',
];

// the cases below are skipped without git-lfs, so CI fails instead of skipping them silently
describe.runIf(isPosix && !!process.env.CI)(
  'util/git/index-lfs.integration on CI',
  () => {
    it(`has git-lfs >= ${GIT_LFS_MIN_VERSION.enabled}`, () => {
      expect(lfsVersion).not.toBeNull();
      expect(hasGitLfsEnabled).toBeTrue();
    });
  },
);

describe.runIf(hasGitLfsUpload)(
  'util/git/index-lfs.integration',
  { timeout: 60000 },
  () => {
    let root: tmp.DirectoryResult;
    let home: string;
    let victim: string;
    let marker: string;
    let caseDir: string;
    let origin: string;
    let localDir: string;
    let caseCount = 0;

    function fixtureEnv(
      extraEnv: Record<string, string> = {},
    ): NodeJS.ProcessEnv {
      return {
        PATH: process.env.PATH,
        HOME: home,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_ALLOW_PROTOCOL: 'file',
        GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
        ...extraEnv,
      };
    }

    /** Runs git for fixture setup and verification, outside of Renovate's env */
    async function run(
      cwd: string,
      args: string[],
      extraEnv?: Record<string, string>,
    ): Promise<string> {
      const { stdout } = await execFileAsync('git', args, {
        cwd,
        env: fixtureEnv(extraEnv),
      });
      return stdout;
    }

    function lfsUrl(url: string): string[] {
      return ['-c', `lfs.url=${url}`, '-c', `lfs.pushurl=${url}`];
    }

    async function countFiles(dir: string): Promise<number> {
      if (!(await fs.pathExists(dir))) {
        return 0;
      }
      let count = 0;
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        count += entry.isDirectory()
          ? await countFiles(upath.join(dir, entry.name))
          : 1;
      }
      return count;
    }

    function originObjects(): Promise<number> {
      return countFiles(`${origin}/lfs/objects`);
    }

    function localObjects(): Promise<number> {
      return countFiles(`${localDir}/.git/lfs/objects`);
    }

    function victimWrites(): Promise<number> {
      return countFiles(`${victim}/.git/lfs`);
    }

    async function installedHooks(): Promise<string[]> {
      const hooks = await fs.readdir(`${localDir}/.git/hooks`);
      return hooks.filter((hook) => !hook.endsWith('.sample'));
    }

    async function isPointerFile(file: string): Promise<boolean> {
      return (
        parseLfsPointer(await fs.readFile(upath.join(localDir, file))) !== null
      );
    }

    async function remoteBlob(ref: string, file: string): Promise<string> {
      return await run(origin, ['cat-file', '-p', `${ref}:${file}`]);
    }

    async function remoteHasRef(ref: string): Promise<boolean> {
      return (await run(origin, ['show-ref', ref]).catch(() => '')) !== '';
    }

    /** Clones a branch with full LFS filters and runs `git lfs fsck`, returns the clone path */
    async function verifyClone(branch: string): Promise<string> {
      const dir = `${caseDir}/verify-${branch.replaceAll('/', '-')}`;
      const url = `file://${origin}`;
      await run(caseDir, [
        ...fullFilters,
        ...lfsUrl(url),
        'clone',
        '-q',
        '-b',
        branch,
        url,
        dir,
      ]);
      await run(dir, [...fullFilters, ...lfsUrl(url), 'lfs', 'fsck']);
      return dir;
    }

    /** Creates a bare repository from the files of each branch, with the LFS objects uploaded */
    async function createTemplate(
      name: string,
      branches: Record<string, Record<string, string | Buffer>>,
      setup?: (seed: string) => Promise<void>,
    ): Promise<void> {
      const bare = `${root.path}/templates/${name}.git`;
      const url = `file://${bare}`;
      await fs.mkdirp(bare);
      await run(bare, ['init', '-q', '--bare']);
      await run(bare, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
      await run(bare, ['config', 'uploadpack.allowFilter', 'true']);
      const seed = `${root.path}/templates/${name}-seed`;
      await fs.mkdirp(seed);
      await run(seed, ['init', '-q', '-b', 'main']);
      await run(seed, ['remote', 'add', 'origin', url]);
      let first = true;
      for (const [branch, files] of Object.entries(branches)) {
        if (!first) {
          await run(seed, ['checkout', '-q', '-b', branch]);
        }
        for (const [file, contents] of Object.entries(files)) {
          await fs.outputFile(upath.join(seed, file), contents);
        }
        if (first) {
          await setup?.(seed);
        }
        await run(seed, [...fullFilters, ...lfsUrl(url), 'add', '-A']);
        await run(seed, [...fullFilters, 'commit', '-qm', `seed ${branch}`]);
        first = false;
      }
      const names = Object.keys(branches);
      await run(seed, [
        ...fullFilters,
        ...lfsUrl(url),
        'lfs',
        'push',
        'origin',
        ...names,
      ]);
      await run(seed, ['push', '-q', '--no-verify', 'origin', ...names]);
    }

    /** Copies a template origin for the current test */
    async function useOrigin(name: string): Promise<void> {
      await fs.copy(`${root.path}/templates/${name}.git`, origin);
    }

    async function initRenovate(
      gitLfs: RepoGlobalConfig['gitLfs'],
      globalConfig: RepoGlobalConfig = {},
    ): Promise<void> {
      GlobalConfig.set({ localDir, gitLfs, ...globalConfig });
      await git.initRepo({ url: `file://${origin}` });
      git.setUserRepoConfig({ gitAuthor });
      await git.syncGit();
    }

    beforeAll(async () => {
      root = await tmp.dir({ unsafeCleanup: true });
      // macOS tmp dirs are symlinks, git and git-lfs report the real path
      root.path = await fs.realpath(root.path);
      home = `${root.path}/home`;
      victim = `${root.path}/victim`;
      marker = `${root.path}/PWNED`;
      await fs.mkdirp(home);

      const maliciousSafetyKeys =
        '[lfs]\n\tfetchinclude = *\n\tallowincompletepush = true\n\tlocksverify = true\n';
      const redirect = `[lfs]\n\turl = file://${victim}\n\tpushurl = file://${victim}\n`;
      await createTemplate('main', {
        main: {
          '.gitattributes': gitattributes,
          '.lfsconfig': maliciousSafetyKeys,
          'a.bin': randomBytes(2000),
          'old.bin': randomBytes(2000),
          'package-lock.json': lock,
          'README.md': 'hi\n',
        },
        other: { 'package-lock.json': otherLock },
      });
      await createTemplate('external', {
        main: {
          '.gitattributes': gitattributes,
          '.lfsconfig': redirect,
          'a.bin': randomBytes(2000),
        },
      });
      await createTemplate('release', {
        main: { 'README.md': 'no LFS here\n' },
        release: {
          '.gitattributes': gitattributes,
          '.lfsconfig': redirect,
          'a.bin': randomBytes(2000),
        },
      });
      await createTemplate('sub', { main: { 'sub.txt': 'submodule\n' } });
      await createTemplate(
        'submodules',
        {
          main: {
            '.gitattributes': gitattributes,
            'a.bin': randomBytes(2000),
          },
        },
        async (seed) => {
          await run(seed, [
            'submodule',
            'add',
            '-q',
            `file://${root.path}/templates/sub.git`,
            'sub',
          ]);
        },
      );
    });

    afterAll(async () => {
      await root.cleanup();
    });

    beforeEach(async () => {
      caseCount += 1;
      caseDir = `${root.path}/case-${caseCount}`;
      origin = `${caseDir}/origin.git`;
      localDir = `${caseDir}/work`;
      await fs.mkdirp(localDir);
      await fs.remove(victim);
      await fs.remove(marker);
      await fs.mkdirp(victim);
      await run(victim, ['init', '-q']);
      memCache.init();
      setCustomEnv({
        HOME: home,
        GIT_ALLOW_PROTOCOL: 'file',
        GIT_CONFIG_NOSYSTEM: '1',
      });
    });

    afterEach(() => {
      setCustomEnv({});
      memCache.reset();
      GlobalConfig.reset();
    });

    it('keeps today behaviour when gitLfs is disabled', async () => {
      await useOrigin('main');
      await initRenovate(undefined);
      const contents = randomBytes(3000);

      await git.commitFiles({
        branchName: 'renovate/raw',
        files: [{ type: 'addition', path: 'new.bin', contents }],
        message: 'raw',
      });

      expect(getLfsState().active).toBeFalse();
      await expect(
        fs.readFile(`${localDir}/.git/config`, 'utf8'),
      ).resolves.not.toMatch(/lfs|hooksPath/);
      const blob = await execFileAsync(
        'git',
        ['cat-file', 'blob', 'renovate/raw:new.bin'],
        { cwd: origin, env: fixtureEnv(), encoding: 'buffer' },
      );
      expect(blob.stdout.equals(contents)).toBeTrue();
      await expect(localObjects()).resolves.toBe(0);
    });

    describe('upload', () => {
      it('clones LFS files as pointers without downloading', async () => {
        await useOrigin('main');

        await initRenovate('upload');

        expect(getLfsState()).toMatchObject({ active: true, mode: 'upload' });
        await expect(isPointerFile('a.bin')).resolves.toBeTrue();
        await expect(isPointerFile('package-lock.json')).resolves.toBeTrue();
        await expect(localObjects()).resolves.toBe(0);
        await expect(installedHooks()).resolves.toEqual([]);
        await expect(git.getRepoStatus()).resolves.toMatchObject({ files: [] });
        await expect(git.getFile('package-lock.json')).resolves.toStartWith(
          LFS_POINTER_VERSION,
        );
      });

      it('commits pointers and uploads exactly the new objects', async () => {
        await useOrigin('main');
        await initRenovate('upload');
        const before = await originObjects();
        const newBin = randomBytes(3000);
        const newLock = '{"lockfileVersion":3,"updated":true}\n';
        const oldPointer = await fs.readFile(`${localDir}/old.bin`);
        const aPointer = await fs.readFile(`${localDir}/a.bin`);

        await git.commitFiles({
          branchName: 'renovate/x',
          files: [
            { type: 'addition', path: 'new.bin', contents: newBin },
            { type: 'addition', path: 'package-lock.json', contents: newLock },
            { type: 'deletion', path: 'old.bin' },
            { type: 'addition', path: 'moved.bin', contents: oldPointer },
            {
              type: 'addition',
              path: 'a.bin',
              contents: aPointer,
              isExecutable: true,
            },
          ],
          message: 'update',
        });

        await expect(remoteBlob('renovate/x', 'new.bin')).resolves.toStartWith(
          LFS_POINTER_VERSION,
        );
        await expect(
          remoteBlob('renovate/x', 'package-lock.json'),
        ).resolves.toStartWith(LFS_POINTER_VERSION);
        await expect(originObjects()).resolves.toBe(before + 2);
        await expect(
          fs.readFile(`${localDir}/.git/config`, 'utf8'),
        ).resolves.not.toMatch(
          /\[filter|hooksPath|\[lfs\][^[]*url =|fetch(?:in|ex)clude/,
        );
        await expect(localObjects()).resolves.toBe(2);
        await expect(installedHooks()).resolves.toEqual([]);
        const clone = await verifyClone('renovate/x');
        expect(
          (await fs.readFile(`${clone}/new.bin`)).equals(newBin),
        ).toBeTrue();
        await expect(
          fs.readFile(`${clone}/package-lock.json`, 'utf8'),
        ).resolves.toBe(newLock);
        expect(
          ((await fs.stat(`${clone}/a.bin`)).mode & 0o111) !== 0,
        ).toBeTrue();
      });

      it('uploads in prepareCommit before the renovate ref is pushed', async () => {
        await useOrigin('main');
        await initRenovate('upload');
        const before = await originObjects();

        const result = await git.prepareCommit({
          branchName: 'renovate/x',
          files: [
            { type: 'addition', path: 'new.bin', contents: randomBytes(3000) },
          ],
          message: 'platform commit',
        });

        await expect(originObjects()).resolves.toBe(before + 1);
        await expect(
          remoteHasRef('refs/renovate/branches/renovate/x'),
        ).resolves.toBeFalse();

        await git.pushCommitToRenovateRef(result!.commitSha, 'renovate/x');

        await expect(
          remoteHasRef('refs/renovate/branches/renovate/x'),
        ).resolves.toBeTrue();
        await expect(installedHooks()).resolves.toEqual([]);
        await expect(
          remoteBlob('refs/renovate/branches/renovate/x', 'new.bin'),
        ).resolves.toStartWith(LFS_POINTER_VERSION);
      });

      it('commits files written by post-upgrade tasks', async () => {
        await useOrigin('main');
        await initRenovate('upload');
        const before = await originObjects();
        const aPointer = await fs.readFile(`${localDir}/a.bin`);
        const built = randomBytes(4000);
        await fs.writeFile(`${localDir}/built.bin`, built);
        // a tool rewriting an untouched pointer byte for byte
        await fs.writeFile(`${localDir}/a.bin`, aPointer);

        const status = await git.getRepoStatus();
        expect(status.files.map(({ path }) => path)).toEqual(['built.bin']);

        await git.commitFiles({
          branchName: 'renovate/built',
          files: [
            {
              type: 'addition',
              path: 'built.bin',
              contents: (await readLocalFile('built.bin'))!,
            },
          ],
          message: 'built',
        });

        await expect(
          remoteBlob('renovate/built', 'built.bin'),
        ).resolves.toStartWith(LFS_POINTER_VERSION);
        await expect(originObjects()).resolves.toBe(before + 1);
        const clone = await verifyClone('renovate/built');
        expect(
          (await fs.readFile(`${clone}/built.bin`)).equals(built),
        ).toBeTrue();
      });

      it('keeps the pinned endpoint for a .lfsconfig written by the commit', async () => {
        await useOrigin('main');
        await initRenovate('upload');
        const before = await originObjects();

        await git.commitFiles({
          branchName: 'renovate/lfsconfig',
          files: [
            {
              type: 'addition',
              path: '.lfsconfig',
              contents: `[lfs]\n\turl = file://${victim}\n\tpushurl = file://${victim}\n`,
            },
            { type: 'addition', path: 'new.bin', contents: randomBytes(3000) },
          ],
          message: 'lfsconfig',
        });

        await expect(victimWrites()).resolves.toBe(0);
        await expect(originObjects()).resolves.toBe(before + 1);
      });

      it('keeps the pinned endpoint for a .lfsconfig on another base branch', async () => {
        await useOrigin('release');
        await initRenovate('upload');
        expect(getLfsState().active).toBeTrue();
        await git.checkoutBranch('release');
        const before = await originObjects();
        const contents = randomBytes(3000);

        await git.commitFiles({
          branchName: 'renovate/release-x',
          files: [{ type: 'addition', path: 'new.bin', contents }],
          message: 'release',
        });

        await expect(victimWrites()).resolves.toBe(0);
        await expect(originObjects()).resolves.toBe(before + 1);
        await expect(
          remoteBlob('renovate/release-x', 'new.bin'),
        ).resolves.toStartWith(LFS_POINTER_VERSION);
        const clone = await verifyClone('renovate/release-x');
        expect(
          (await fs.readFile(`${clone}/new.bin`)).equals(contents),
        ).toBeTrue();
      });

      it('ignores GIT_CONFIG_GLOBAL from the repository env', async () => {
        await useOrigin('main');
        const evil = `${localDir}/evil.gitconfig`;
        setUserEnv({ GIT_CONFIG_GLOBAL: evil });
        await initRenovate('upload');

        await git.commitFiles({
          branchName: 'renovate/evil',
          files: [
            {
              type: 'addition',
              path: 'evil.gitconfig',
              contents: `[lfs]\n\tstandalonetransferagent = evil\n[lfs "customtransfer.evil"]\n\tpath = sh\n\targs = -c \\"touch ${marker}\\"\n`,
            },
            { type: 'addition', path: 'new.bin', contents: randomBytes(3000) },
          ],
          message: 'evil',
        });

        await expect(fs.pathExists(marker)).resolves.toBeFalse();
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { keys: ['GIT_CONFIG_GLOBAL'] },
          'Ignoring repository env variables that would change Git configuration because gitLfs is enabled',
        );

        // control: the same env runs the attacker's command without Renovate's protection
        const { oid } = parseLfsPointer(
          await remoteBlob('renovate/evil', 'new.bin'),
        )!;
        await run(
          localDir,
          [
            ...lfsUrl(`file://${origin}`),
            'lfs',
            'push',
            '--object-id',
            'origin',
            oid,
          ],
          { GIT_CONFIG_GLOBAL: evil },
        ).catch(() => null);
        await expect(fs.pathExists(marker)).resolves.toBeTrue();
      });

      it('ignores GIT_COMMON_DIR from the repository env', async () => {
        await useOrigin('main');
        setUserEnv({ GIT_COMMON_DIR: 'evil' });
        await initRenovate('upload');

        await git.commitFiles({
          branchName: 'renovate/evil',
          files: [
            {
              type: 'addition',
              path: 'evil/config',
              contents: `[remote "origin"]\n\turl = file://${origin}\n[lfs]\n\tstandalonetransferagent = evil\n[lfs "customtransfer.evil"]\n\tpath = sh\n\targs = -c \\"touch ${marker}\\"\n`,
            },
            {
              type: 'addition',
              path: 'evil/HEAD',
              contents: 'ref: refs/heads/main\n',
            },
            { type: 'addition', path: 'evil/refs/heads/.keep', contents: '' },
            { type: 'addition', path: 'evil/objects/.keep', contents: '' },
            { type: 'addition', path: 'new.bin', contents: randomBytes(3000) },
          ],
          message: 'evil',
        });

        await expect(fs.pathExists(marker)).resolves.toBeFalse();
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { keys: ['GIT_COMMON_DIR'] },
          'Ignoring repository env variables that would change Git configuration because gitLfs is enabled',
        );

        // control: the same env runs the attacker's command without Renovate's protection
        const { oid } = parseLfsPointer(
          await remoteBlob('renovate/evil', 'new.bin'),
        )!;
        await run(
          localDir,
          [
            ...lfsUrl(`file://${origin}`),
            'lfs',
            'push',
            '--object-id',
            'origin',
            oid,
          ],
          { GIT_COMMON_DIR: 'evil' },
        ).catch(() => null);
        await expect(fs.pathExists(marker)).resolves.toBeTrue();
      });

      it('fails closed for a .lfsconfig pointing to another LFS server', async () => {
        await useOrigin('external');
        await initRenovate('upload');
        const contents = randomBytes(3000);

        await git.commitFiles({
          branchName: 'renovate/raw',
          files: [{ type: 'addition', path: 'new.bin', contents }],
          message: 'raw',
        });

        expect(getLfsState()).toMatchObject({
          active: false,
          inactiveReason: 'external-lfs-server',
        });
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { host: '' },
          "Git LFS support is inactive for this repository because .lfsconfig points to a different LFS server. Renovate only uploads to the repository's own LFS storage",
        );
        const blob = await execFileAsync(
          'git',
          ['cat-file', 'blob', 'renovate/raw:new.bin'],
          { cwd: origin, env: fixtureEnv(), encoding: 'buffer' },
        );
        expect(blob.stdout.equals(contents)).toBeTrue();
        await expect(victimWrites()).resolves.toBe(0);
        await expect(localObjects()).resolves.toBe(0);
      });

      it('fails closed when git-lfs disappears at runtime', async () => {
        await useOrigin('main');
        const bin = `${caseDir}/bin`;
        await fs.mkdirp(bin);
        for (const tool of ['git', 'git-lfs']) {
          const { stdout } = await execFileAsync('which', [tool]);
          await fs.symlink(stdout.trim(), `${bin}/${tool}`);
        }
        setCustomEnv({
          HOME: home,
          GIT_ALLOW_PROTOCOL: 'file',
          GIT_CONFIG_NOSYSTEM: '1',
          PATH: bin,
        });
        await initRenovate('upload');
        await fs.remove(`${bin}/git-lfs`);

        await expect(
          git.commitFiles({
            branchName: 'renovate/x',
            files: [
              {
                type: 'addition',
                path: 'new.bin',
                contents: randomBytes(3000),
              },
            ],
            message: 'no git-lfs',
          }),
        ).rejects.toThrow("clean filter 'lfs' failed");

        await expect(
          remoteHasRef('refs/heads/renovate/x'),
        ).resolves.toBeFalse();
      });

      it('keeps the LFS env after cloning submodules', async () => {
        await useOrigin('submodules');
        await initRenovate('upload');
        const before = await originObjects();

        await git.cloneSubmodules(true, undefined);

        await expect(
          fs.readFile(`${localDir}/sub/sub.txt`, 'utf8'),
        ).resolves.toBe('submodule\n');
        await git.commitFiles({
          branchName: 'renovate/x',
          files: [
            { type: 'addition', path: 'x.bin', contents: randomBytes(3000) },
          ],
          message: 'after submodules',
        });

        await expect(remoteBlob('renovate/x', 'x.bin')).resolves.toStartWith(
          LFS_POINTER_VERSION,
        );
        await expect(originObjects()).resolves.toBe(before + 1);
        await expect(installedHooks()).resolves.toEqual([]);
      });
    });

    describe.runIf(hasGitLfsEnabled)('enabled', () => {
      it('materializes gitLfsInclude paths', async () => {
        await useOrigin('main');
        await initRenovate('enabled');

        await git.initGitLfs({ gitLfsInclude: ['package-lock.json'] });

        await expect(
          fs.readFile(`${localDir}/package-lock.json`, 'utf8'),
        ).resolves.toBe(lock);
        await expect(isPointerFile('a.bin')).resolves.toBeTrue();
        await expect(isPointerFile('old.bin')).resolves.toBeTrue();
        await expect(localObjects()).resolves.toBe(1);
        await expect(git.getRepoStatus()).resolves.toMatchObject({ files: [] });
        expect(logger.logger.info).toHaveBeenCalledWith(
          'Git LFS: materialized 1 file(s) (0.0 MiB) matching gitLfsInclude',
        );

        await git.checkoutBranch('other');
        await expect(
          fs.readFile(`${localDir}/package-lock.json`, 'utf8'),
        ).resolves.toBe(otherLock);
        await git.checkoutBranch('main');
        await expect(
          fs.readFile(`${localDir}/package-lock.json`, 'utf8'),
        ).resolves.toBe(lock);

        await git.commitFiles({
          branchName: 'renovate/readme',
          files: [{ type: 'addition', path: 'README.md', contents: 'hello\n' }],
          message: 'readme',
        });
        await expect(
          fs.readFile(`${localDir}/package-lock.json`, 'utf8'),
        ).resolves.toBe(lock);
        await expect(isPointerFile('a.bin')).resolves.toBeTrue();

        await expect(git.getFile('package-lock.json')).resolves.toBe(lock);
        await expect(
          fs.readFile(`${localDir}/.git/config`, 'utf8'),
        ).resolves.not.toMatch(
          /\[filter|hooksPath|\[lfs\][^[]*url =|fetch(?:in|ex)clude/,
        );
        await expect(git.getFile('a.bin')).resolves.toStartWith(
          LFS_POINTER_VERSION,
        );
        await expect(isPointerFile('a.bin')).resolves.toBeTrue();
        await expect(installedHooks()).resolves.toEqual([]);
      });

      it('commits a materialized file as a pointer', async () => {
        await useOrigin('main');
        await initRenovate('enabled');
        await git.initGitLfs({ gitLfsInclude: ['package-lock.json'] });
        const before = await originObjects();
        const newLock = '{"lockfileVersion":3,"x":1}\n';

        await git.commitFiles({
          branchName: 'renovate/lock',
          files: [
            { type: 'addition', path: 'package-lock.json', contents: newLock },
          ],
          message: 'lock',
        });

        await expect(
          remoteBlob('renovate/lock', 'package-lock.json'),
        ).resolves.toStartWith(LFS_POINTER_VERSION);
        await expect(originObjects()).resolves.toBe(before + 1);
        await expect(
          fs.readFile(`${localDir}/package-lock.json`, 'utf8'),
        ).resolves.toBe(newLock);
      });

      it('downloads nothing for an empty gitLfsInclude', async () => {
        await useOrigin('main');
        await initRenovate('enabled');
        await expect(localObjects()).resolves.toBe(0);

        await git.initGitLfs({ gitLfsInclude: [] });
        await git.checkoutBranch('other');

        await expect(localObjects()).resolves.toBe(0);
        await expect(isPointerFile('package-lock.json')).resolves.toBeTrue();
        await expect(git.getFile('package-lock.json')).resolves.toStartWith(
          LFS_POINTER_VERSION,
        );
        await expect(localObjects()).resolves.toBe(0);
      });

      it('ignores repository env overrides of the pinned config', async () => {
        await useOrigin('submodules');
        await initRenovate('enabled');
        const victimUrl = `file://${victim}`;
        // the repository env is only known after the clone, the env rebuild in `initGitLfs` leaves it out and `cloneSubmodules` picks it up
        setUserEnv({
          GIT_CONFIG_PARAMETERS: `'lfs.pushurl'='${victimUrl}' 'lfs.url'='${victimUrl}'`,
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'lfs.pushurl',
          GIT_CONFIG_VALUE_0: victimUrl,
        });
        await git.initGitLfs({ gitLfsInclude: ['a.bin'] });
        await git.cloneSubmodules(true, undefined);
        const before = await originObjects();

        await git.commitFiles({
          branchName: 'renovate/env',
          files: [
            { type: 'addition', path: 'new.bin', contents: randomBytes(3000) },
          ],
          message: 'env',
        });

        await expect(victimWrites()).resolves.toBe(0);
        await expect(originObjects()).resolves.toBe(before + 1);
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          'Ignoring GIT_CONFIG_* from repository env because gitLfs is enabled',
        );

        // control: GIT_CONFIG_PARAMETERS beats a pinned endpoint without Renovate's protection
        const { oid } = parseLfsPointer(
          await remoteBlob('renovate/env', 'new.bin'),
        )!;
        await run(localDir, ['lfs', 'push', '--object-id', 'origin', oid], {
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_0: 'lfs.url',
          GIT_CONFIG_VALUE_0: `file://${origin}`,
          GIT_CONFIG_KEY_1: 'lfs.pushurl',
          GIT_CONFIG_VALUE_1: `file://${origin}`,
          GIT_CONFIG_PARAMETERS: `'lfs.pushurl'='${victimUrl}'`,
        });
        await expect(victimWrites()).resolves.toBeGreaterThan(0);
      });
    });
  },
);
