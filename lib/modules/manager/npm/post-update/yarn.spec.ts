import { codeBlock } from 'common-tags';
import fs from 'fs-extra';
import { mockDeep } from 'vitest-mock-extended';
import type { ExecSnapshots } from '~test/exec-util.ts';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import * as util from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import * as docker from '../../../../util/exec/docker/index.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import { getPkgReleases } from '../../../datasource/index.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import { getNodeToolConstraint } from './node-version.ts';
import type { GenerateLockFileResult } from './types.ts';
import * as yarnHelper from './yarn.ts';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures.ts')>(
      '~test/fixtures.ts',
    )
  ).fsExtra(),
);
vi.mock('../../../../util/exec/env.ts');
vi.mock('./node-version.ts');
vi.mock('../../../datasource/index.ts', () => mockDeep());

delete process.env.NPM_CONFIG_CACHE;

// TODO: figure out snapshot similarity for each CI platform (#9617)
function fixSnapshots(snapshots: ExecSnapshots): ExecSnapshots {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));
}

const plocktest1PackageJson = Fixtures.get('plocktest1/package.json', '..');
const plocktest1YarnLockV1 = Fixtures.get('plocktest1/yarn.lock', '..');

const yarn1Install =
  'yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts';
const berryEnv = {
  CI: 'true',
  YARN_ENABLE_GLOBAL_CACHE: '1',
  YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  YARN_ENABLE_SCRIPTS: '0',
  YARN_HTTP_TIMEOUT: '100000',
};
const berryV3Env = {
  CI: 'true',
  YARN_ENABLE_GLOBAL_CACHE: '1',
  YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  YARN_HTTP_TIMEOUT: '100000',
};
function expectedExec(
  cmds: string[],
  env: Record<string, string>,
  cwd = 'some-dir',
): { cmd: string; options: { cwd: string; env: Record<string, string> } }[] {
  return cmds.map((cmd) => ({ cmd, options: { cwd, env } }));
}

describe('modules/manager/npm/post-update/yarn', () => {
  const removeDockerContainer = vi.spyOn(docker, 'removeDockerContainer');

  beforeEach(() => {
    util.env.getChildProcessEnv.mockReturnValue(envMock.basic);
    vi.stubEnv('BUILDPACK', undefined);
    vi.stubEnv('HTTP_PROXY', undefined);
    vi.stubEnv('HTTPS_PROXY', undefined);
    vi.stubEnv('RENOVATE_X_YARN_PROXY', undefined);
    Fixtures.reset();
    GlobalConfig.set({
      localDir: '.',
      cacheDir: '/tmp/cache',
      binarySource: 'global',
    });
    removeDockerContainer.mockResolvedValue();
    docker.resetPrefetchedImages();
    vi.mocked(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
    ['3.0.0', '3.0.0', 1],
  ])(
    'generates lock files using yarn v%s',
    async (yarnVersion, yarnCompatibility, expectedFsCalls) => {
      Fixtures.mock(
        {
          '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
          'yarn.lock': 'package-lock-contents',
        },
        '/some-dir',
      );
      GlobalConfig.set({
        localDir: '/',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile(
        'some-dir',
        {
          YARN_CACHE_FOLDER: '/tmp/renovate/cache/yarn',
          YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry',
        },
        config,
      );
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(res.lockFile).toBe('package-lock-contents');
      const expectedByVersion: Record<
        string,
        { cmds: string[]; env: Record<string, string> }
      > = {
        '1.22.0': {
          cmds: [
            yarn1Install,
            'npx yarn-deduplicate --strategy fewer',
            yarn1Install,
            'npx yarn-deduplicate --strategy highest',
            yarn1Install,
          ],
          env: { CI: 'true', YARN_CACHE_FOLDER: '/tmp/renovate/cache/yarn' },
        },
        '2.1.0': {
          cmds: ['yarn install'],
          env: { ...berryEnv, YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry' },
        },
        '2.2.0': {
          cmds: ['yarn install', 'yarn dedupe --strategy highest'],
          env: { ...berryEnv, YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry' },
        },
        '3.0.0': {
          cmds: [
            'yarn install --mode=update-lockfile',
            'yarn dedupe --strategy highest --mode=update-lockfile',
          ],
          env: {
            ...berryV3Env,
            YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry',
          },
        },
      };
      const { cmds, env } = expectedByVersion[yarnVersion];
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(cmds, env, '/some-dir'),
      );
    },
  );

  describe.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
    ['3.0.0', '3.0.0', 1],
  ])(
    'passes NODE_OPTIONS using yarn v%s',
    (yarnVersion, yarnCompatibility, _expectedFsCalls) => {
      it('if nodeMaxMemory set on global config', async () => {
        Fixtures.mock(
          {
            '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
            'yarn.lock': 'package-lock-contents',
          },
          '/some-dir',
        );
        GlobalConfig.set({
          localDir: '/',
          cacheDir: '/tmp/cache',
          toolSettings: {
            nodeMaxMemory: 2345,
          },
          binarySource: 'global',
        });
        const execSnapshots = mockExecAll({
          stdout: yarnVersion,
          stderr: '',
        });
        const config = {
          constraints: {
            yarn: yarnCompatibility,
          },
          postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
        };
        const res = await yarnHelper.generateLockFile(
          'some-dir',
          {
            YARN_CACHE_FOLDER: '/tmp/renovate/cache/yarn',
            YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry',
          },
          config,
        );
        expect(res.error).toBeUndefined();

        // there may be other command(s), but checking that at least 1 has it is sufficient
        expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
          '--max-old-space-size=2345',
        );
      });

      it('if nodeMaxMemory set on repo config', async () => {
        Fixtures.mock(
          {
            '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
            'yarn.lock': 'package-lock-contents',
          },
          '/some-dir',
        );
        GlobalConfig.set({
          localDir: '/',
          cacheDir: '/tmp/cache',
          binarySource: 'global',
        });
        const execSnapshots = mockExecAll({
          stdout: yarnVersion,
          stderr: '',
        });
        const config = {
          constraints: {
            yarn: yarnCompatibility,
          },
          postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
          toolSettings: {
            nodeMaxMemory: 2345,
          },
        };
        const res = await yarnHelper.generateLockFile(
          'some-dir',
          {
            YARN_CACHE_FOLDER: '/tmp/renovate/cache/yarn',
            YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry',
          },
          config,
        );
        expect(res.error).toBeUndefined();

        // there may be other command(s), but checking that at least 1 has it is sufficient
        expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
          '--max-old-space-size=2345',
        );
      });
    },
  );

  it('only skips build if skipInstalls is false', async () => {
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    const execSnapshots = mockExecAll({
      stdout: '3.0.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '3.0.0',
      },
      postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      skipInstalls: false,
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchObject(
      expectedExec(
        [
          'yarn install --mode=skip-build',
          'yarn dedupe --strategy highest --mode=skip-build',
        ],
        berryV3Env,
      ),
    );
  });

  it('allows and ignore scripts', async () => {
    GlobalConfig.set({
      localDir: '.',
      allowScripts: true,
      cacheDir: '/tmp/cache',
      binarySource: 'global',
    });
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    const execSnapshots = mockExecAll({
      stdout: '3.0.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '3.0.0',
      },
      ignoreScripts: true,
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchObject(
      expectedExec(['yarn install --mode=update-lockfile'], berryV3Env),
    );
    // scripts must not be explicitly disabled because allowScripts is set
    expect(execSnapshots[0].options?.env?.YARN_ENABLE_SCRIPTS).toBeUndefined();
  });

  it('sets http proxy', async () => {
    vi.stubEnv('HTTP_PROXY', 'http://proxy');
    vi.stubEnv('HTTPS_PROXY', 'http://proxy');
    vi.stubEnv('RENOVATE_X_YARN_PROXY', 'true');
    GlobalConfig.set({
      localDir: '.',
      allowScripts: true,
      cacheDir: '/tmp/cache',
      binarySource: 'global',
    });
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    const execSnapshots = mockExecAll({
      stdout: '3.0.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '3.0.0',
      },
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchObject([
      { cmd: 'yarn config unset --home httpProxy' },
      { cmd: 'yarn config set --home httpProxy http://proxy' },
      { cmd: 'yarn config unset --home httpsProxy' },
      { cmd: 'yarn config set --home httpsProxy http://proxy' },
      {},
    ]);
  });

  it('does not use global cache if zero install is detected', async () => {
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '>= 2.0.0',
      },
      postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      managerData: { yarnZeroInstall: true },
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchObject(
      expectedExec(['yarn install'], {
        CI: 'true',
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
        YARN_ENABLE_SCRIPTS: '0',
        YARN_HTTP_TIMEOUT: '100000',
      }),
    );
    // the global cache must not be used when zero install is detected
    expect(
      execSnapshots[0].options?.env?.YARN_ENABLE_GLOBAL_CACHE,
    ).toBeUndefined();
  });

  it('does not use global cache if any upgrade has zero install', async () => {
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '>= 2.0.0',
      },
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
      { depName: 'some-dep', newValue: '^1.0.0' },
      {
        depName: 'other-dep',
        newValue: '^2.0.0',
        managerData: { yarnZeroInstall: true },
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).not.toBeEmptyArray();
    for (const snapshot of execSnapshots) {
      expect(snapshot.options?.env).not.toHaveProperty(
        'YARN_ENABLE_GLOBAL_CACHE',
      );
    }
  });

  it.each([
    ['1.22.0', '^1.10.0'],
    ['2.1.0', '>= 2.0.0'],
    ['3.0.0', '3.0.0'],
  ])(
    'performs lock file updates using yarn v%s',
    async (yarnVersion, yarnCompatibility) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir',
      );
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        {
          depName: 'some-dep',
          newValue: '^1.0.0',
          isLockfileUpdate: true,
        },
        {
          depName: 'some-dep',
          newValue: '^1.0.0',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      const expectedByVersion: Record<
        string,
        { cmds: string[]; env: Record<string, string> }
      > = {
        '1.22.0': {
          cmds: [
            yarn1Install,
            'yarn upgrade some-dep --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
          ],
          env: { CI: 'true' },
        },
        '2.1.0': {
          cmds: ['yarn install', 'yarn up -R some-dep'],
          env: berryEnv,
        },
        '3.0.0': {
          cmds: [
            'yarn install --mode=update-lockfile',
            'yarn up -R some-dep --mode=update-lockfile',
          ],
          env: berryV3Env,
        },
      };
      const { cmds, env } = expectedByVersion[yarnVersion];
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(cmds, env),
      );
    },
  );

  it.each([['1.22.0']])(
    'performs lock file updates and full install using yarn v%s',
    async (yarnVersion) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir',
      );
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
        {
          depName: 'some-dep',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(
          [
            yarn1Install,
            'yarn upgrade some-dep --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
          ],
          { CI: 'true' },
        ),
      );
    },
  );

  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
  ])(
    'performs lock file maintenance using yarn v%s',
    async (yarnVersion, yarnCompatibility, expectedFsCalls) => {
      Fixtures.mock(
        {
          '.yarnrc': null,
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir',
      );
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        { isLockFileMaintenance: true },
      ]);
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);

      // expected the lock file not to be deleted.
      expect(res.lockFile).toBe('');
      const expectedByVersion: Record<
        string,
        { cmds: string[]; env: Record<string, string> }
      > = {
        '1.22.0': {
          cmds: [
            yarn1Install,
            'npx yarn-deduplicate --strategy fewer',
            yarn1Install,
            'npx yarn-deduplicate --strategy highest',
            yarn1Install,
          ],
          env: { CI: 'true' },
        },
        '2.1.0': {
          cmds: ['yarn install'],
          env: berryEnv,
        },
        '2.2.0': {
          cmds: ['yarn install', 'yarn dedupe --strategy highest'],
          env: berryEnv,
        },
      };
      const { cmds, env } = expectedByVersion[yarnVersion];
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(cmds, env),
      );
    },
  );

  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
    ['3.0.0', '3.0.0', 1],
  ])(
    'performs lock file maintenance in subdirectory independent workspaces using yarn v%s',
    async (yarnVersion, yarnCompatibility, expectedFsReadCalls) => {
      Fixtures.mock(
        {
          '.yarnrc': null,
          'package.json': JSON.stringify({ name: 'main-workspace' }),
          'yarn.lock': 'main-workspace-lock-contents',
          'sub_workspace/package.json': JSON.stringify({
            name: 'sub-workspace',
          }),
          'sub_workspace/yarn.lock': 'sub-workspace-lock-contents',
        },
        'some-dir',
      );
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile(
        'some-dir/sub_workspace',
        {},
        config,
        [{ isLockFileMaintenance: true }],
      );
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsReadCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);

      // Expect the lock file to be not deleted before `yarn install` is run.
      // The lock file should exist but just be empty. This is necessary for
      // subdirectory isolated workspaces to work with Yarn 2+.
      expect(res.lockFile).toBe('');
      expect(fs.outputFile).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fs.outputFile).mock.calls[0][0]).toEndWith(
        'some-dir/sub_workspace/yarn.lock',
      );
      const expectedByVersion: Record<
        string,
        { cmds: string[]; env: Record<string, string> }
      > = {
        '1.22.0': {
          cmds: [
            yarn1Install,
            'npx yarn-deduplicate --strategy fewer',
            yarn1Install,
            'npx yarn-deduplicate --strategy highest',
            yarn1Install,
          ],
          env: { CI: 'true' },
        },
        '2.1.0': {
          cmds: ['yarn install'],
          env: berryEnv,
        },
        '2.2.0': {
          cmds: ['yarn install', 'yarn dedupe --strategy highest'],
          env: berryEnv,
        },
        '3.0.0': {
          cmds: [
            'yarn install --mode=update-lockfile',
            'yarn dedupe --strategy highest --mode=update-lockfile',
          ],
          env: berryV3Env,
        },
      };
      const { cmds, env } = expectedByVersion[yarnVersion];
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(cmds, env, 'some-dir/sub_workspace'),
      );
    },
  );

  it.each`
    yarnVersion | yarnCompatibility | depType
    ${'1.22.0'} | ${'^1.10.0'}      | ${'packageManager'}
    ${'2.1.0'}  | ${'>= 2.0.0'}     | ${'packageManager'}
    ${'1.22.0'} | ${'^1.10.0'}      | ${'devEngines.packageManager'}
    ${'2.1.0'}  | ${'>= 2.0.0'}     | ${'devEngines.packageManager'}
  `(
    'performs $depType yarn binary update using yarn v$yarnVersion',
    async ({ yarnVersion, yarnCompatibility, depType }) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir',
      );
      const execSnapshots = mockExecAll({
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        {
          depName: 'yarn',
          depType,
          newValue: '3.0.1',
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchObject(
        expectedExec(
          ['yarn set version 3.0.1', 'yarn install --mode=update-lockfile'],
          berryV3Env,
        ),
      );
    },
  );

  it('catches errors', async () => {
    Fixtures.mock({});
    const execSnapshots = mockExecAll(new Error('some-error'));
    const res = await yarnHelper.generateLockFile('some-dir', {});
    expect(fs.readFile).toHaveBeenCalledTimes(3);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(fixSnapshots(execSnapshots)).toMatchObject(
      expectedExec([yarn1Install], { CI: 'true' }),
    );
  });

  it('supports corepack', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    Fixtures.mock(
      {
        'package.json': '{ "packageManager": "yarn@3.0.0" }',
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
      constraints: {
        yarn: '^3.0.0',
      },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool corepack 0.10.0', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --mode=update-lockfile',
        options: {
          cwd: 'some-dir',
          env: {
            YARN_ENABLE_GLOBAL_CACHE: '1',
            YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
            YARN_HTTP_TIMEOUT: '100000',
          },
        },
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
  });

  it('supports packageManager url corepack', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    const yarnLockContents = codeBlock`
      __metadata:
          version: 6
          cacheKey: 8
    `;
    Fixtures.mock(
      {
        'package.json':
          '{ "packageManager": "yarn@https://nexus-proxy.repo.local.company.net/nexus/content/groups/npm-all/@yarnpkg/cli-dist/-/cli-dist-3.7.0.tgz#sha224.a06723957ae0292e21f598a453" }',
        'yarn.lock': yarnLockContents,
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool corepack 0.10.0', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --mode=update-lockfile',
        options: {
          cwd: 'some-dir',
          env: {
            YARN_ENABLE_GLOBAL_CACHE: '1',
            YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
            YARN_HTTP_TIMEOUT: '100000',
          },
        },
      },
    ]);
    expect(res.lockFile).toBe(yarnLockContents);
  });

  it('supports corepack on grouping', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    Fixtures.mock(
      {
        'package.json': '{ "packageManager": "yarn@3.0.0" }',
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      constraints: {
        yarn: '^3.0.0',
      },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
      {
        managerData: { hasPackageManager: true },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool corepack 0.10.0', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --mode=update-lockfile',
        options: {
          cwd: 'some-dir',
          env: {
            YARN_ENABLE_GLOBAL_CACHE: '1',
            YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
            YARN_HTTP_TIMEOUT: '100000',
          },
        },
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
  });

  it('supports customizing corepack version via config constraints', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');

    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });

    Fixtures.mock(
      {
        'package.json': '{ "packageManager": "yarn@3.0.0" }',
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );

    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '0.17.0' },
        { version: '0.17.1' },
        { version: '0.18.0' },
      ],
    });

    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });

    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
      constraints: {
        yarn: '^3.0.0',
        corepack: '^0.17.0',
      },
    });

    const res = await yarnHelper.generateLockFile('some-dir', {}, config);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool corepack 0.17.1', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --mode=update-lockfile',
        options: {
          cwd: 'some-dir',
          env: {
            YARN_ENABLE_GLOBAL_CACHE: '1',
            YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
            YARN_HTTP_TIMEOUT: '100000',
          },
        },
      },
    ]);

    expect(res.lockFile).toBe('package-lock-contents');
  });

  it('falls back to the extracted corepack constraint', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');

    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });

    Fixtures.mock(
      {
        'package.json': '{ "packageManager": "yarn@3.0.0" }',
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir',
    );

    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '0.17.0' },
        { version: '0.17.1' },
        { version: '0.18.0' },
      ],
    });

    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });

    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
      // the yarn version from `package.json` wins over the extracted one, which
      // would otherwise select yarn 1
      extractedConstraints: {
        yarn: '1.22.0',
        corepack: '^0.17.0',
      },
    });

    const res = await yarnHelper.generateLockFile('some-dir', {}, config);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool corepack 0.17.1', options: { cwd: 'some-dir' } },
      { cmd: 'yarn install --mode=update-lockfile' },
    ]);

    expect(res.lockFile).toBe('package-lock-contents');
  });

  it('uses slim yarn instead of corepack', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    Fixtures.mock(
      {
        'package.json':
          '{ "packageManager": "yarn@1.22.18", "dependencies": { "chalk": "^2.4.1" } }',
        'yarn.lock': plocktest1YarnLockV1,
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }, { version: '2.4.3' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool yarn-slim 1.22.18', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('uses devEngine.packageManager(object) instead of corepack', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    Fixtures.mock(
      {
        'package.json':
          '{ "devEngines": {"packageManager": { "name": "yarn", "version": "1.22.19" } }, "packageManager": "yarn@1.22.18", "dependencies": { "chalk": "^2.4.1" } }',
        'yarn.lock': plocktest1YarnLockV1,
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.19' }, { version: '2.4.3' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool yarn-slim 1.22.19', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('uses devEngine.packageManager(array) instead of corepack', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    Fixtures.mock(
      {
        'package.json':
          '{ "devEngines": {"packageManager": [{ "name": "yarn", "version": "1.22.19" }] }, "packageManager": "yarn@1.22.18", "dependencies": { "chalk": "^2.4.1" } }',
        'yarn.lock': plocktest1YarnLockV1,
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.19' }, { version: '2.4.3' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({
      managerData: { hasPackageManager: true },
    });
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0', options: { cwd: 'some-dir' } },
      { cmd: 'install-tool yarn-slim 1.22.19', options: { cwd: 'some-dir' } },
      {
        cmd: 'yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('patches local yarn', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    expect(plocktest1PackageJson).toBeTruthy();
    GlobalConfig.set({
      localDir: '.',
      cacheDir: '/tmp/cache',
      binarySource: 'global',
    });
    Fixtures.mock(
      {
        'package.json': plocktest1PackageJson,
        '.yarn/cli.js': '',
        'yarn.lock': plocktest1YarnLockV1,
        '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }],
    });
    const execSnapshots = mockExecSequence([
      { stdout: '', stderr: '' },
      { stdout: '', stderr: '' },
      { stdout: '', stderr: '' },
    ]);
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({});
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    const options = { cwd: 'some-dir' };
    expect(execSnapshots).toMatchObject([
      {
        cmd: {
          command: [
            'sed',
            '-i',
            `s/ steps,/ steps.slice(0,1),/`,
            'some-dir/.yarn/cli.js',
          ],
          ignoreFailure: true,
        },
        options,
      },
      {
        cmd: 'yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts',
        options,
      },
    ]);
  });

  it('patches local yarn (docker)', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    expect(plocktest1PackageJson).toBeTruthy();
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'docker',
      cacheDir: '/tmp/cache',
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    Fixtures.mock(
      {
        'package.json': plocktest1PackageJson,
        '.yarn/cli.js': '',
        'yarn.lock': plocktest1YarnLockV1,
        '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
      },
      'some-dir',
    );
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }],
    });
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const config = util.partial<PostUpdateConfig<NpmManagerData>>({});
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    const options = {};
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image', options },
      {
        cmd:
          `docker run --rm --name=renovate_sidecar --label=renovate_child -v ".":"." -v "/tmp/cache":"/tmp/cache" -e CI -e CONTAINERBASE_CACHE_DIR -w "some-dir" ghcr.io/renovatebot/base-image ` +
          `bash -l -c '` +
          `install-tool node 16.16.0` +
          ` && ` +
          `install-tool yarn-slim 1.22.18` +
          ` && ` +
          // the preCommand's own single quotes are POSIX-escaped, since the whole
          // command is now the single-quoted argument of `bash -l -c`
          `sed -i '"'"'s/ steps,/ steps.slice(0,1),/'"'"' some-dir/.yarn/cli.js || true` +
          ` && ` +
          `yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts` +
          `'`,
        options: { ...options, cwd: 'some-dir' },
      },
    ]);
  });

  describe('minimumReleaseAge', () => {
    const hourMs = 60 * 60 * 1000;
    const young = new Date(Date.now() - hourMs).toISOString() as Timestamp;
    const old = '2020-01-01T00:00:00.000Z' as Timestamp;
    const update: Upgrade<NpmManagerData> = {
      manager: 'npm',
      depName: 'foo',
      datasource: 'npm',
      newVersion: '1.2.3',
      releaseTimestamp: young,
      minimumReleaseAgePackageManagerSync: true,
      minimumReleaseAgeRepository: '3 days',
    };

    function mockYarnFiles(yarnrc?: string): void {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
          ...(yarnrc && { '.yarnrc.yml': yarnrc }),
        },
        'some-dir',
      );
    }

    async function generateLockFile(
      upgrades: Upgrade<NpmManagerData>[],
      yarn = '4.12.0',
    ): Promise<{
      res: GenerateLockFileResult;
      env: Partial<Record<string, string>>;
    }> {
      const execSnapshots = mockExecAll();
      const res = await yarnHelper.generateLockFile(
        'some-dir',
        {},
        { constraints: { yarn } },
        upgrades,
      );
      return { res, env: execSnapshots[0].options!.env! };
    }

    function quarantineError(stdout: string): ExecError {
      return new ExecError('yarn failed', {
        cmd: 'yarn install --mode=update-lockfile',
        stdout,
        stderr: '',
        options: {},
      });
    }

    it.each`
      name                       | upgrade
      ${'an update'}             | ${{}}
      ${'lock file maintenance'} | ${{ isLockFileMaintenance: true }}
    `(
      'passes nothing without minimumReleaseAgePackageManagerSync for $name',
      async ({ upgrade }) => {
        mockYarnFiles('npmMinimalAgeGate: 3d\n');

        const { res, env } = await generateLockFile([
          {
            ...update,
            minimumReleaseAgePackageManagerSync: undefined,
            minimumReleaseAge: '7 days',
            ...upgrade,
          },
        ]);

        expect(res.error).toBeUndefined();
        expect(env).not.toHaveProperty('YARN_NPM_MINIMAL_AGE_GATE');
        expect(env).not.toHaveProperty('YARN_NPM_PREAPPROVED_PACKAGES');
      },
    );

    it.each`
      yarn        | minimumReleaseAge | yarnrc                            | expected
      ${'4.12.0'} | ${'7 days'}       | ${undefined}                      | ${'10080'}
      ${'4.12.0'} | ${'1 day'}        | ${'npmMinimalAgeGate: 7d\n'}      | ${'10080'}
      ${'4.12.0'} | ${'90 seconds'}   | ${undefined}                      | ${'2'}
      ${'4.12.0'} | ${'1 hour'}       | ${'npmMinimalAgeGate: 61.5\n'}    | ${'62'}
      ${'4.12.0'} | ${'1 hour'}       | ${undefined}                      | ${'60'}
      ${'4.15.0'} | ${'1 hour'}       | ${undefined}                      | ${'1440'}
      ${'4.15.0'} | ${'1 hour'}       | ${'npmMinimalAgeGate: 0\n'}       | ${'60'}
      ${'4.15.0'} | ${'1 hour'}       | ${'npmMinimalAgeGate: bananas\n'} | ${'1440'}
    `(
      'passes $expected minutes for Yarn $yarn, minimumReleaseAge=$minimumReleaseAge and yarnrc=$yarnrc',
      async ({ yarn, minimumReleaseAge, yarnrc, expected }) => {
        mockYarnFiles(yarnrc);

        const { res, env } = await generateLockFile(
          [
            {
              manager: 'npm',
              ...update,
              depName: undefined,
              minimumReleaseAgeRepository: minimumReleaseAge,
            },
          ],
          yarn,
        );

        expect(res).toEqual({ lockFile: 'package-lock-contents' });
        expect(env.YARN_NPM_MINIMAL_AGE_GATE).toBe(expected);
        expect(env).not.toHaveProperty('YARN_NPM_PREAPPROVED_PACKAGES');
      },
    );

    it.each`
      yarn        | upgrade
      ${'^4.0.0'} | ${{}}
      ${'3.8.0'}  | ${{}}
      ${'latest'} | ${{}}
      ${'4.12.0'} | ${{ isVulnerabilityAlert: true }}
      ${'4.12.0'} | ${{ minimumReleaseAgeRepository: null }}
    `(
      'passes nothing for Yarn $yarn and $upgrade',
      async ({ yarn, upgrade }) => {
        mockYarnFiles('npmMinimalAgeGate: 3d\n');

        const { env } = await generateLockFile(
          [{ ...update, ...upgrade }],
          yarn,
        );

        expect(env).not.toHaveProperty('YARN_NPM_MINIMAL_AGE_GATE');
        expect(env).not.toHaveProperty('YARN_NPM_PREAPPROVED_PACKAGES');
      },
    );

    it('passes the minimumReleaseAge of lock file maintenance and preapproves nothing', async () => {
      mockYarnFiles();

      const { env } = await generateLockFile([
        {
          ...update,
          isLockFileMaintenance: true,
          minimumReleaseAge: '7 days',
        },
      ]);

      expect(env.YARN_NPM_MINIMAL_AGE_GATE).toBe('10080');
      expect(env).not.toHaveProperty('YARN_NPM_PREAPPROVED_PACKAGES');
    });

    it.each`
      name                                       | yarnrc                                                 | updates                                                                 | expected
      ${'the .yarnrc.yml entries first'}         | ${"npmPreapprovedPackages:\n  - '@types/*'\n"}         | ${[update]}                                                             | ${'@types/*,foo@1.2.3'}
      ${'each update once'}                      | ${undefined}                                           | ${[update, update, { ...update, depName: 'bar', newVersion: '2.0.0' }]} | ${'foo@1.2.3,bar@2.0.0'}
      ${'the packageName of aliases'}            | ${undefined}                                           | ${[{ ...update, depName: 'my-foo', packageName: 'foo' }]}               | ${'foo@1.2.3'}
      ${'the newName of replacements'}           | ${undefined}                                           | ${[{ ...update, newName: 'bar', newVersion: '2.0.0' }]}                 | ${'bar@2.0.0'}
      ${'updates without a timestamp'}           | ${undefined}                                           | ${[{ ...update, releaseTimestamp: undefined }]}                         | ${'foo@1.2.3'}
      ${'packages of other scopes'}              | ${'npmScopes:\n  myorg:\n    npmMinimalAgeGate: 1h\n'} | ${[{ ...update, depName: '@other/foo' }]}                               | ${'@other/foo@1.2.3'}
      ${'no packages of a scope with an age'}    | ${'npmScopes:\n  myorg:\n    npmMinimalAgeGate: 1h\n'} | ${[{ ...update, depName: '@myorg/foo' }]}                               | ${undefined}
      ${'no old releases'}                       | ${undefined}                                           | ${[{ ...update, releaseTimestamp: old }]}                               | ${undefined}
      ${'no releases younger than the Yarn age'} | ${'npmMinimalAgeGate: 2h\n'}                           | ${[update]}                                                             | ${undefined}
      ${'no preapproved packages'}               | ${'npmPreapprovedPackages:\n  - foo\n'}                | ${[update]}                                                             | ${undefined}
      ${'no preapproved versions'}               | ${"npmPreapprovedPackages:\n  - 'foo@^1.0.0'\n"}       | ${[update]}                                                             | ${undefined}
      ${'no updates without a version'}          | ${undefined}                                           | ${[{ ...update, newVersion: undefined }]}                               | ${undefined}
      ${'no updates without a name'}             | ${undefined}                                           | ${[{ ...update, depName: undefined }]}                                  | ${undefined}
      ${'no other datasources'}                  | ${undefined}                                           | ${[{ ...update, datasource: 'node-version' }]}                          | ${undefined}
    `('preapproves $name', async ({ yarnrc, updates, expected }) => {
      mockYarnFiles(yarnrc);

      const { res, env } = await generateLockFile(updates);

      expect(res).toEqual({ lockFile: 'package-lock-contents' });
      expect(env.YARN_NPM_MINIMAL_AGE_GATE).toBeDefined();
      expect(env.YARN_NPM_PREAPPROVED_PACKAGES).toBe(expected);
    });

    it.each`
      stdout                                                                                                                 | expected
      ${'➤ YN0082: │ foo@npm:1.2.3: All versions satisfying "1.2.3" are quarantined'}                                        | ${'`foo@1.2.3`'}
      ${'➤ YN0082: │ @scope/bar@npm:latest: The version for tag "latest" is quarantined, and no lower version is available'} | ${'`@scope/bar@latest`'}
    `(
      'reports the quarantined packages: $stdout',
      async ({ stdout, expected }) => {
        mockYarnFiles();
        mockExecAll(quarantineError(stdout));

        const res = await yarnHelper.generateLockFile(
          'some-dir',
          {},
          { constraints: { yarn: '4.12.0' } },
          [update],
        );

        expect(res).toEqual({
          error: true,
          stderr: `Yarn found no version old enough for the minimum release age: ${expected}\n\n${stdout}`,
          stdout,
        });
      },
    );

    it('returns the Yarn error unchanged without minimumReleaseAgePackageManagerSync', async () => {
      const stdout =
        '➤ YN0082: │ foo@npm:1.2.3: All versions satisfying "1.2.3" are quarantined';
      mockYarnFiles();
      mockExecAll(quarantineError(stdout));

      const res = await yarnHelper.generateLockFile(
        'some-dir',
        {},
        { constraints: { yarn: '4.12.0' } },
        [{ ...update, minimumReleaseAgePackageManagerSync: undefined }],
      );

      expect(res).toEqual({ error: true, stderr: '', stdout });
    });
  });

  describe('getQuarantinedPackages()', () => {
    it('returns each quarantined package once', () => {
      expect(
        yarnHelper.getQuarantinedPackages(codeBlock`
          ➤ YN0082: │ foo@npm:^1.0.0: All versions satisfying "^1.0.0" are quarantined
          ➤ YN0082: │ foo@npm:^1.0.0: All versions satisfying "^1.0.0" are quarantined
          ➤ YN0082: │ bar@npm:latest: The version for tag "latest" is quarantined, and no lower version is available
        `),
      ).toEqual(['foo@^1.0.0', 'bar@latest']);
    });

    it('returns no packages for other errors', () => {
      expect(
        yarnHelper.getQuarantinedPackages(
          '➤ YN0082: │ foo@npm:9.9.9: No candidates found',
        ),
      ).toEqual([]);
    });
  });

  describe('checkYarnrc()', () => {
    it('returns offline mirror and yarn path', async () => {
      Fixtures.mock(
        {
          '/tmp/renovate/.yarn/cli.js': '',
          '/tmp/renovate/.yarnrc':
            'yarn-offline-mirror "./packages-cache"\nyarn-path "./.yarn/cli.js"\n',
        },
        '/',
      );
      GlobalConfig.set({
        localDir: '/tmp/renovate',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      await expect(yarnHelper.checkYarnrc('.')).resolves.toEqual({
        offlineMirror: true,
        yarnPath: '.yarn/cli.js',
      });
    });

    it('returns yarn path in subdir', async () => {
      Fixtures.mock(
        {
          '.yarn/cli.js': '',
          '.yarnrc': 'yarn-path "./.yarn/cli.js"\n',
        },
        'some-dir',
      );
      await expect(yarnHelper.checkYarnrc('some-dir')).resolves.toEqual({
        offlineMirror: false,
        yarnPath: 'some-dir/.yarn/cli.js',
      });
    });

    it('returns offline mirror', async () => {
      Fixtures.mock(
        {
          '/tmp/renovate/.yarnrc': 'yarn-offline-mirror "./packages-cache"\n',
        },
        '/',
      );
      GlobalConfig.set({
        localDir: '/tmp/renovate',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      await expect(yarnHelper.checkYarnrc('.')).resolves.toEqual({
        offlineMirror: true,
        yarnPath: null,
      });
    });

    it('returns no offline mirror and no absolute yarn path', async () => {
      Fixtures.mock(
        {
          '.yarn/cli.js': '',
          '/tmp/renovate/.yarnrc': 'yarn-path /.yarn/cli.js\n',
        },
        '/',
      );
      GlobalConfig.set({
        localDir: '/tmp',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      await expect(yarnHelper.checkYarnrc('renovate')).resolves.toEqual({
        offlineMirror: false,
        yarnPath: null,
      });
    });

    it('returns offline mirror and no yarn path for non-existant yarn-path binary', async () => {
      Fixtures.mock(
        {
          '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
        },
        '/tmp/renovate',
      );
      GlobalConfig.set({
        localDir: '/tmp/renovate',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      const { offlineMirror, yarnPath } = await yarnHelper.checkYarnrc('.');
      expect(offlineMirror).toBeFalse();
      expect(yarnPath).toBeNull();
      expect(Fixtures.toJSON()['/tmp/renovate/.yarnrc']).toBe('\n');
    });

    it('removes pure-lockfile and frozen-lockfile from .yarnrc', async () => {
      Fixtures.mock(
        {
          '.yarnrc': `--install.pure-lockfile true\n--install.frozen-lockfile true\n`,
        },
        '/tmp/renovate',
      );
      GlobalConfig.set({
        localDir: '/tmp/renovate',
        cacheDir: '/tmp/cache',
        binarySource: 'global',
      });
      await yarnHelper.checkYarnrc('/tmp/renovate');
      expect(Fixtures.toJSON()['/tmp/renovate/.yarnrc']).toBe('\n\n');
    });
  });

  describe('fuzzyMatchAdditionalYarnrcYml()', () => {
    it.each`
      additionalRegistry            | existingRegistry                    | expectedRegistry
      ${['//my-private-registry']}  | ${['//my-private-registry']}        | ${['//my-private-registry']}
      ${[]}                         | ${['//my-private-registry']}        | ${[]}
      ${[]}                         | ${[]}                               | ${[]}
      ${null}                       | ${null}                             | ${[]}
      ${['//my-private-registry']}  | ${[]}                               | ${['//my-private-registry']}
      ${['//my-private-registry']}  | ${['https://my-private-registry']}  | ${['https://my-private-registry']}
      ${['//my-private-registry']}  | ${['http://my-private-registry']}   | ${['http://my-private-registry']}
      ${['//my-private-registry']}  | ${['http://my-private-registry/']}  | ${['http://my-private-registry/']}
      ${['//my-private-registry']}  | ${['https://my-private-registry/']} | ${['https://my-private-registry/']}
      ${['//my-private-registry']}  | ${['//my-private-registry/']}       | ${['//my-private-registry/']}
      ${['//my-private-registry/']} | ${['//my-private-registry/']}       | ${['//my-private-registry/']}
      ${['//my-private-registry/']} | ${['//my-private-registry']}        | ${['//my-private-registry']}
    `(
      'should return $expectedRegistry when parsing $additionalRegistry against local $existingRegistry',
      ({
        additionalRegistry,
        existingRegistry,
        expectedRegistry,
      }: Record<
        'additionalRegistry' | 'existingRegistry' | 'expectedRegistry',
        string[]
      >) => {
        expect(
          yarnHelper.fuzzyMatchAdditionalYarnrcYml(
            {
              npmRegistries: additionalRegistry?.reduce(
                (acc, cur) => ({
                  ...acc,
                  [cur]: { npmAuthToken: 'xxxxxx' },
                }),
                {},
              ),
            },
            {
              npmRegistries: existingRegistry?.reduce(
                (acc, cur) => ({
                  ...acc,
                  [cur]: { npmAuthToken: 'xxxxxx' },
                }),
                {},
              ),
            },
          ).npmRegistries,
        ).toContainAllKeys(expectedRegistry);
      },
    );
  });
});
