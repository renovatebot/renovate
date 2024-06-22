import fs from 'fs-extra';
import { mockDeep } from 'jest-mock-extended';
import {
  ExecSnapshots,
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import { env, mockedFunction, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import * as docker from '../../../../util/exec/docker';
import { getPkgReleases } from '../../../datasource';
import type { PostUpdateConfig } from '../../types';
import type { NpmManagerData } from '../types';
import { getNodeToolConstraint } from './node-version';
import * as yarnHelper from './yarn';

jest.mock('fs-extra', () =>
  jest
    .requireActual<
      typeof import('../../../../../test/fixtures')
    >('../../../../../test/fixtures')
    .fsExtra(),
);
jest.mock('../../../../util/exec/env');
jest.mock('./node-version');
jest.mock('../../../datasource', () => mockDeep());

delete process.env.NPM_CONFIG_CACHE;

// TODO: figure out snapshot similarity for each CI platform (#9617)
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));

const plocktest1PackageJson = Fixtures.get('plocktest1/package.json', '..');
const plocktest1YarnLockV1 = Fixtures.get('plocktest1/yarn.lock', '..');

env.getChildProcessEnv.mockReturnValue(envMock.basic);

describe('modules/manager/npm/post-update/yarn', () => {
  const removeDockerContainer = jest.spyOn(docker, 'removeDockerContainer');

  beforeEach(() => {
    delete process.env.BUILDPACK;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.RENOVATE_X_YARN_PROXY;
    Fixtures.reset();
    GlobalConfig.set({ localDir: '.', cacheDir: '/tmp/cache' });
    removeDockerContainer.mockResolvedValue();
    docker.resetPrefetchedImages();
    mockedFunction(getNodeToolConstraint).mockResolvedValueOnce({
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
      GlobalConfig.set({ localDir: '/', cacheDir: '/tmp/cache' });
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
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
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
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it('allows and ignore scripts', async () => {
    GlobalConfig.set({
      localDir: '.',
      allowScripts: true,
      cacheDir: '/tmp/cache',
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
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it('sets http proxy', async () => {
    process.env.HTTP_PROXY = 'http://proxy';
    process.env.HTTPS_PROXY = 'http://proxy';
    process.env.RENOVATE_X_YARN_PROXY = 'true';
    GlobalConfig.set({
      localDir: '.',
      allowScripts: true,
      cacheDir: '/tmp/cache',
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
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
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
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
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
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
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
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
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
      expect(mockedFunction(fs.outputFile).mock.calls[0][0]).toEndWith(
        'some-dir/sub_workspace/yarn.lock',
      );
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    },
  );

  it.each([
    ['1.22.0', '^1.10.0'],
    ['2.1.0', '>= 2.0.0'],
  ])(
    'performs yarn binary update using yarn v%s',
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
          depName: 'yarn',
          depType: 'packageManager',
          newValue: '3.0.1',
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    },
  );

  it('catches errors', async () => {
    Fixtures.mock({});
    const execSnapshots = mockExecAll(new Error('some-error'));
    const res = await yarnHelper.generateLockFile('some-dir', {});
    expect(fs.readFile).toHaveBeenCalledTimes(3);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it('supports corepack', async () => {
    process.env.CONTAINERBASE = 'true';
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
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = partial<PostUpdateConfig<NpmManagerData>>({
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
    process.env.CONTAINERBASE = 'true';
    GlobalConfig.set({
      localDir: '.',
      binarySource: 'install',
      cacheDir: '/tmp/cache',
    });
    const yarnLockContents = `__metadata:
    version: 6
    cacheKey: 8`;
    Fixtures.mock(
      {
        'package.json':
          '{ "packageManager": "yarn@https://nexus-proxy.repo.local.company.net/nexus/content/groups/npm-all/@yarnpkg/cli-dist/-/cli-dist-3.7.0.tgz#sha224.a06723957ae0292e21f598a453" }',
        'yarn.lock': yarnLockContents,
      },
      'some-dir',
    );
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = partial<PostUpdateConfig<NpmManagerData>>({
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
    process.env.CONTAINERBASE = 'true';
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
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '0.10.0' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = partial<PostUpdateConfig<NpmManagerData>>({
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
    process.env.CONTAINERBASE = 'true';

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

    mockedFunction(getPkgReleases).mockResolvedValueOnce({
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

    const config = partial<PostUpdateConfig<NpmManagerData>>({
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

  it('uses slim yarn instead of corepack', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    process.env.CONTAINERBASE = 'true';
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
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }, { version: '2.4.3' }],
    });
    const execSnapshots = mockExecAll({
      stdout: '2.1.0',
      stderr: '',
    });
    const config = partial<PostUpdateConfig<NpmManagerData>>({
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

  it('patches local yarn', async () => {
    // sanity check for later refactorings
    expect(plocktest1YarnLockV1).toBeTruthy();
    expect(plocktest1PackageJson).toBeTruthy();
    GlobalConfig.set({ localDir: '.', cacheDir: '/tmp/cache' });
    Fixtures.mock(
      {
        'package.json': plocktest1PackageJson,
        '.yarn/cli.js': '',
        'yarn.lock': plocktest1YarnLockV1,
        '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
      },
      'some-dir',
    );
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }],
    });
    const execSnapshots = mockExecSequence([
      { stdout: '', stderr: '' },
      { stdout: '', stderr: '' },
      { stdout: '', stderr: '' },
    ]);
    const config = partial<PostUpdateConfig<NpmManagerData>>({});
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    const options = { encoding: 'utf-8', cwd: 'some-dir' };
    expect(execSnapshots).toMatchObject([
      {
        cmd: `sed -i 's/ steps,/ steps.slice(0,1),/' some-dir/.yarn/cli.js || true`,
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
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
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
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [{ version: '1.22.18' }],
    });
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const config = partial<PostUpdateConfig<NpmManagerData>>({});
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe(plocktest1YarnLockV1);
    const options = { encoding: 'utf-8' };
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar', options },
      {
        cmd:
          `docker run --rm --name=renovate_sidecar --label=renovate_child -v ".":"." -v "/tmp/cache":"/tmp/cache" -e CI -e CONTAINERBASE_CACHE_DIR -w "some-dir" ghcr.io/containerbase/sidecar ` +
          `bash -l -c "` +
          `install-tool node 16.16.0` +
          ` && ` +
          `install-tool yarn-slim 1.22.18` +
          ` && ` +
          `sed -i 's/ steps,/ steps.slice(0,1),/' some-dir/.yarn/cli.js || true` +
          ` && ` +
          `yarn install --ignore-engines --ignore-platform --network-timeout 100000 --ignore-scripts` +
          `"`,
        options: { ...options, cwd: 'some-dir' },
      },
    ]);
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
      GlobalConfig.set({ localDir: '/tmp/renovate', cacheDir: '/tmp/cache' });
      expect(await yarnHelper.checkYarnrc('.')).toEqual({
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
      expect(await yarnHelper.checkYarnrc('some-dir')).toEqual({
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
      GlobalConfig.set({ localDir: '/tmp/renovate', cacheDir: '/tmp/cache' });
      expect(await yarnHelper.checkYarnrc('.')).toEqual({
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
      GlobalConfig.set({ localDir: '/tmp', cacheDir: '/tmp/cache' });
      expect(await yarnHelper.checkYarnrc('renovate')).toEqual({
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
      GlobalConfig.set({ localDir: '/tmp/renovate', cacheDir: '/tmp/cache' });
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
      GlobalConfig.set({ localDir: '/tmp/renovate', cacheDir: '/tmp/cache' });
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
