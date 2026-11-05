import { codeBlock } from 'common-tags';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { getNodeToolConstraint } from './node-version.ts';
import * as pnpmHelper from './pnpm.ts';

vi.mock('../../../../util/exec/env.ts');
vi.mock('../../../../util/fs/index.ts');
vi.mock('./node-version.ts');

delete process.env.NPM_CONFIG_CACHE;
process.env.CONTAINERBASE = 'true';

function mockPnpmFiles(workspaceFileContent?: string) {
  fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
  fs.readLocalFile.mockImplementation((fileName: string): Promise<string> => {
    if (fileName === 'some-folder/pnpm-lock.yaml') {
      return Promise.resolve('package-lock-contents');
    }
    if (
      fileName === 'some-folder/pnpm-workspace.yaml' &&
      workspaceFileContent
    ) {
      return Promise.resolve(workspaceFileContent);
    }
    return Promise.resolve('unexpected file name');
  });
  fs.localPathExists.mockResolvedValueOnce(workspaceFileContent !== undefined); // pnpm-workspace.yaml
}

describe('modules/manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  const upgrades: Upgrade[] = [{}];

  beforeEach(() => {
    config = partial<PostUpdateConfig>({ constraints: { pnpm: '^2.0.0' } });
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '', binarySource: 'global' });
    vi.mocked(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it('does nothing when no upgrades', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(execSnapshots).toMatchObject([]);
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with packages', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(
      codeBlock`
        packages:
          - pkg-a
      `,
    );

    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with packages using pnpm 10.x', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(
      codeBlock`
        packages:
          - pkg-a
          - pkg-b
      `,
    );
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      { ...config, constraints: { pnpm: '10.x' } },
      [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: true,
        },
        {
          packageName: 'some-other-dep',
          newVersion: '1.1.0',
          isLockfileUpdate: true,
        },
      ],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for non workspace using pnpm 10.x', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(); // no workspace file
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      { ...config, constraints: { pnpm: '10.x' } },
      [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: true,
        },
        {
          packageName: 'some-other-dep',
          newVersion: '1.1.0',
          isLockfileUpdate: true,
        },
      ],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with empty package list', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(codeBlock`packages: []`);
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        packageName: 'some-dep',
        newVersion: '1.0.1',
        isLockfileUpdate: true,
      },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with config but no package list', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(codeBlock`
      overrides:
        "foo@1.0.0>bar": "-"
`);
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        packageName: 'some-dep',
        newVersion: '1.0.1',
        isLockfileUpdate: true,
      },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates and install when lock file updates mixed with regular updates', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        sharedVariableName: 'some-group',
        packageName: 'some-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
      {
        sharedVariableName: 'some-group',
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: false,
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
      {
        cmd: 'pnpm update --no-save some-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      { isLockFileMaintenance: true },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('performs dedupe', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const postUpdateOptions = ['pnpmDedupe'];
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, postUpdateOptions },
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
      {
        cmd: 'pnpm dedupe --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs dedupe without --recursive for workspaces', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(
      codeBlock`
        packages:
          - pkg-a
      `,
    );
    const postUpdateOptions = ['pnpmDedupe'];
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      { ...config, postUpdateOptions },
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
      {
        cmd: 'pnpm dedupe --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('uses the new version if packageManager is updated', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      {
        depType: 'packageManager',
        depName: 'pnpm',
        newValue: '6.16.1',
        newVersion: '6.16.1',
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: { cwd: 'some-dir' },
      },
    ]);
    // TODO: check docker preCommands
  });

  it('uses constraint version if parent json has constraints', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = Fixtures.get('parent/package.json');
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'packageManager',
          depName: 'pnpm',
        },
      ],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses packageManager version and puts it into constraint', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = Fixtures.get('manager-field/package.json');
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'packageManager',
          depName: 'pnpm',
        },
      ],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses volta version and puts it into constraint', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = codeBlock`
    {
  "name": "parent",
  "version": "1.0.0",
  "engines": {
    "pnpm": "^6.0.0"
  },
  "engine-strict": true,
  "volta": {
    "pnpm": "6.15.0"
  }
}

    `;
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'volta',
          depName: 'pnpm',
        },
      ],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses skips pnpm v7 if lockfileVersion indicates <7', async () => {
    mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    fs.readLocalFile
      .mockResolvedValueOnce('{}') // package.json
      .mockResolvedValue('lockfileVersion: 5.3\n'); // pnpm-lock.yaml
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.lockFile).toBe('lockfileVersion: 5.3\n');
  });

  it('works for docker mode', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'docker',
      allowScripts: true,
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp":"/tmp" ' +
          '-e CI ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "some-dir" ' +
          'ghcr.io/renovatebot/base-image ' +
          "bash -l -c '" +
          'install-tool node 16.16.0 ' +
          '&& install-tool pnpm 6.0.0 ' +
          '&& pnpm install --lockfile-only --no-frozen-lockfile' +
          "'",
      },
    ]);
  });

  it('works for install mode', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
    ]);
  });

  it('falls back to the extracted pnpm constraint', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: {}, extractedConstraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
    ]);
  });

  it('prefers the derived pnpm constraint over the extracted one', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{"packageManager":"pnpm@7.0.0"}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: {}, extractedConstraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 7.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
      },
    ]);
  });

  it('allows pnpmfile even if ignoring scripts', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
      allowScripts: true,
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' }, ignoreScripts: true },
      upgrades,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile',
      },
    ]);
  });

  describe('passes NODE_OPTIONS', () => {
    it('if nodeMaxMemory set on global config', async () => {
      GlobalConfig.set({
        localDir: '',
        toolSettings: {
          nodeMaxMemory: 1234,
        },
        binarySource: 'global',
      });
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValue('package-lock-contents');
      const res = await pnpmHelper.generateLockFile(
        'some-dir',
        {},
        {
          ...config,
        },
        upgrades,
      );
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=1234',
      );
    });

    it('if nodeMaxMemory set on repo config', async () => {
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValue('package-lock-contents');
      const res = await pnpmHelper.generateLockFile(
        'some-dir',
        {},
        {
          ...config,
          toolSettings: {
            nodeMaxMemory: 1234,
          },
        },
        upgrades,
      );
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=1234',
      );
    });
  });

  const pnpmInstall =
    'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile';

  function immatureError(stdout: string): ExecError {
    return new ExecError('pnpm failed', {
      cmd: pnpmInstall,
      stdout,
      stderr: '',
      options: {},
    });
  }

  describe('minimumReleaseAge without minimumReleaseAgePackageManagerSync', () => {
    it.each`
      name                       | upgrade
      ${'an update'}             | ${{}}
      ${'lock file maintenance'} | ${{ isLockFileMaintenance: true }}
    `(
      'passes no minimum release age to pnpm for $name',
      async ({ upgrade }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(
          "minimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - '@myorg/*'\n",
        );

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '^11.0.0' } },
          [
            {
              manager: 'npm',
              depName: 'foo',
              datasource: 'npm',
              newVersion: '1.2.3',
              releaseTimestamp: '2020-01-01T00:00:00.000Z' as Timestamp,
              minimumReleaseAge: '7 days',
              minimumReleaseAgeRepository: '7 days',
              minimumReleaseAgeExtracted: '1 day',
              ...upgrade,
            },
          ],
          'minimum-release-age=2880\n',
        );

        expect(res).toEqual({ lockFile: 'package-lock-contents' });
        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} --no-frozen-lockfile` },
        ]);
      },
    );

    it.each`
      stdout
      ${'ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 1.2.3 (released 2 hours ago) of foo does not meet the minimumReleaseAge constraint'}
      ${'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  foo@1.2.3 was published within the minimumReleaseAge cutoff'}
    `('returns the pnpm error unchanged: $stdout', async ({ stdout }) => {
      mockExecSequence([immatureError(stdout)]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
        {
          manager: 'npm',
          minimumReleaseAge: '1 day',
          minimumReleaseAgeRepository: '1 day',
        },
      ]);

      expect(res).toEqual({ error: true, stderr: '', stdout });
    });
  });

  describe('minimumReleaseAge with minimumReleaseAgePackageManagerSync', () => {
    it.each`
      minimumReleaseAge | workspace                         | flag
      ${'7 days'}       | ${undefined}                      | ${'--config.minimum-release-age=10080'}
      ${'7 days'}       | ${'minimumReleaseAge: 1440\n'}    | ${'--config.minimum-release-age=10080'}
      ${'1 day'}        | ${'minimumReleaseAge: 10080\n'}   | ${'--config.minimum-release-age=10080'}
      ${'90 seconds'}   | ${'packages: []\n'}               | ${'--config.minimum-release-age=2'}
      ${'1 day'}        | ${'minimumReleaseAge: bananas\n'} | ${'--config.minimum-release-age=1440'}
      ${'1 day'}        | ${'- not a mapping\n'}            | ${'--config.minimum-release-age=1440'}
    `(
      'passes $flag for minimumReleaseAge=$minimumReleaseAge and workspace=$workspace',
      async ({ minimumReleaseAge, workspace, flag }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(workspace);

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          config,
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge,
              minimumReleaseAgeRepository: minimumReleaseAge,
            },
          ],
        );

        expect(res.lockFile).toBe('package-lock-contents');
        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} ${flag} --no-frozen-lockfile` },
        ]);
      },
    );

    it.each`
      pnpm          | minimumReleaseAge | workspace                    | npmrc                              | minutes
      ${'^11.0.0'}  | ${'1 hour'}       | ${undefined}                 | ${null}                            | ${1440}
      ${'^11.0.0'}  | ${'7 days'}       | ${undefined}                 | ${null}                            | ${10080}
      ${'^11.0.0'}  | ${'1 hour'}       | ${'minimumReleaseAge: 0\n'}  | ${null}                            | ${60}
      ${'^11.0.0'}  | ${'1 hour'}       | ${undefined}                 | ${'minimum-release-age=2880\n'}    | ${1440}
      ${'>=9'}      | ${'1 hour'}       | ${undefined}                 | ${'minimum-release-age=2880\n'}    | ${1440}
      ${undefined}  | ${'1 hour'}       | ${undefined}                 | ${null}                            | ${1440}
      ${'^10.20.0'} | ${'1 hour'}       | ${undefined}                 | ${null}                            | ${60}
      ${'^10.20.0'} | ${'1 day'}        | ${undefined}                 | ${'minimum-release-age=2880\n'}    | ${2880}
      ${'^10.20.0'} | ${'1 day'}        | ${'minimumReleaseAge: 60\n'} | ${'minimum-release-age=2880\n'}    | ${1440}
      ${'^10.20.0'} | ${'1 hour'}       | ${undefined}                 | ${'minimum-release-age=bananas\n'} | ${60}
    `(
      'passes $minutes minutes for pnpm $pnpm, minimumReleaseAge=$minimumReleaseAge, workspace=$workspace and npmrc=$npmrc',
      async ({ pnpm, minimumReleaseAge, workspace, npmrc, minutes }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(workspace);

        await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm } },
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge,
              minimumReleaseAgeRepository: minimumReleaseAge,
            },
          ],
          npmrc,
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: `${pnpmInstall} --config.minimum-release-age=${minutes} --no-frozen-lockfile`,
          },
        ]);
      },
    );

    it.each`
      minimumReleaseAge | upgrade
      ${null}           | ${{}}
      ${'0 days'}       | ${{}}
      ${'bananas'}      | ${{}}
      ${'7 days'}       | ${{ isVulnerabilityAlert: true }}
    `(
      'does not pass a minimum release age for minimumReleaseAge=$minimumReleaseAge and $upgrade',
      async ({ minimumReleaseAge, upgrade }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles('minimumReleaseAge: 1440\n');

        await pnpmHelper.generateLockFile('some-folder', {}, config, [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAgeRepository: minimumReleaseAge,
            ...upgrade,
          },
        ]);

        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} --no-frozen-lockfile` },
        ]);
      },
    );

    it('passes minimumReleaseAge for lock file maintenance', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles();

      await pnpmHelper.generateLockFile('some-folder', {}, config, [
        {
          manager: 'npm',
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '7 days',
          minimumReleaseAgeRepository: '1 day',
        },
      ]);

      expect(execSnapshots).toMatchObject([
        {
          cmd: `${pnpmInstall} --config.minimum-release-age=10080 --no-frozen-lockfile`,
        },
      ]);
    });

    it('does not pass an invalid minimumReleaseAge for lock file maintenance', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles();

      await pnpmHelper.generateLockFile('some-folder', {}, config, [
        {
          manager: 'npm',
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: 'bananas',
        },
      ]);

      expect(execSnapshots).toMatchObject([
        { cmd: `${pnpmInstall} --no-frozen-lockfile` },
      ]);
    });

    it('passes minimumReleaseAgeRepository instead of a larger minimumReleaseAge for updates', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, minimumReleaseAge: '14 days' },
        [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            depName: 'foo',
            datasource: 'npm',
            minimumReleaseAge: '14 days',
            minimumReleaseAgeRepository: '3 days',
          },
        ],
      );

      expect(res).toEqual({ lockFile: 'package-lock-contents' });
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${pnpmInstall} --config.minimum-release-age=4320 --no-frozen-lockfile`,
        },
      ]);
    });

    it('uses the minimumReleaseAgeRepository of the upgrades, not of the branch config', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles();

      await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, minimumReleaseAgeRepository: '7 days' },
        [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            depName: 'foo',
            minimumReleaseAgeRepository: '3 days',
          },
        ],
      );

      expect(execSnapshots).toMatchObject([
        {
          cmd: `${pnpmInstall} --config.minimum-release-age=4320 --no-frozen-lockfile`,
        },
      ]);
    });

    it('uses the minimumReleaseAgeRepository of the branch config without upgrades', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles();

      await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        {
          ...config,
          minimumReleaseAgeRepository: '3 days',
          minimumReleaseAgePackageManagerSync: true,
          postUpdateOptions: ['pnpmDedupe'],
        },
      );

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pnpm dedupe --lockfile-only --ignore-scripts --ignore-pnpmfile --config.minimum-release-age=4320',
        },
      ]);
    });

    describe('minimumReleaseAgeExclude', () => {
      const flag = '--config.minimum-release-age=4320';
      const foo = '--config.minimum-release-age-exclude=foo@1.2.3';
      const bar = '--config.minimum-release-age-exclude=bar@2.0.0';
      const update = {
        depName: 'foo',
        datasource: 'npm',
        newVersion: '1.2.3',
        releaseTimestamp: '2020-01-01T00:00:00.000Z' as Timestamp,
      };

      it.each`
        name                              | workspace                                                  | updates                                                                 | expected
        ${'the workspace entries first'}  | ${"minimumReleaseAgeExclude:\n  - '@myorg/*'\n"}           | ${[update]}                                                             | ${`${flag} '--config.minimum-release-age-exclude=@myorg/*' ${foo}`}
        ${'a single entry twice'}         | ${undefined}                                               | ${[update]}                                                             | ${`${flag} ${foo} ${foo}`}
        ${'each update once'}             | ${undefined}                                               | ${[update, update, { ...update, depName: 'bar', newVersion: '2.0.0' }]} | ${`${flag} ${foo} ${bar}`}
        ${'the packageName of overrides'} | ${undefined}                                               | ${[{ ...update, depName: 'foo@<1.0.0', packageName: 'foo' }]}           | ${`${flag} ${foo} ${foo}`}
        ${'the newName of replacements'}  | ${undefined}                                               | ${[{ ...update, newName: 'bar', newVersion: '2.0.0' }]}                 | ${`${flag} ${bar} ${bar}`}
        ${'a version union'}              | ${"minimumReleaseAgeExclude:\n  - 'bar@1.0.0 || 2.0.0'\n"} | ${[update]}                                                             | ${`${flag} '--config.minimum-release-age-exclude=bar@1.0.0 || 2.0.0' ${foo}`}
        ${'no excluded packages'}         | ${'minimumReleaseAgeExclude:\n  - foo\n'}                  | ${[update]}                                                             | ${flag}
        ${'no excluded versions'}         | ${"minimumReleaseAgeExclude:\n  - 'foo@1.2.3'\n"}          | ${[update]}                                                             | ${flag}
        ${'no updates without a version'} | ${undefined}                                               | ${[{ ...update, newVersion: undefined }]}                               | ${flag}
        ${'no updates without a name'}    | ${undefined}                                               | ${[{ ...update, depName: undefined }]}                                  | ${flag}
        ${'no other datasources'}         | ${undefined}                                               | ${[{ ...update, datasource: 'node-version' }]}                          | ${flag}
      `('passes $name', async ({ workspace, updates, expected }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(workspace);

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '^11.0.0' } },
          updates.map((upgrade: Upgrade) => ({
            ...upgrade,
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAgeRepository: '3 days',
          })),
        );

        expect(res).toEqual({ lockFile: 'package-lock-contents' });
        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} ${expected} --no-frozen-lockfile` },
        ]);
      });

      it.each`
        pnpm           | upgrade                            | expected
        ${undefined}   | ${{}}                              | ${`${flag} ${foo} ${foo}`}
        ${'>=10.19.0'} | ${{}}                              | ${`${flag} ${foo} ${foo}`}
        ${'~10.18.0'}  | ${{}}                              | ${flag}
        ${'>=9'}       | ${{}}                              | ${flag}
        ${'^11.0.0'}   | ${{ isLockFileMaintenance: true }} | ${flag}
      `(
        'passes $expected for pnpm $pnpm and $upgrade',
        async ({ pnpm, upgrade, expected }) => {
          const execSnapshots = mockExecAll();
          mockPnpmFiles();

          await pnpmHelper.generateLockFile(
            'some-folder',
            {},
            { ...config, constraints: { pnpm } },
            [
              {
                ...update,
                manager: 'npm',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '3 days',
                minimumReleaseAgeRepository: '3 days',
                ...upgrade,
              },
            ],
          );

          expect(execSnapshots).toMatchObject([
            { cmd: `${pnpmInstall} ${expected} --no-frozen-lockfile` },
          ]);
        },
      );

      it('passes the excludes to lock file updates', async () => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles();

        await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '^11.0.0' } },
          [
            {
              ...update,
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'foo',
              isLockfileUpdate: true,
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: `pnpm update --no-save foo@1.2.3 --lockfile-only --ignore-scripts --ignore-pnpmfile ${flag} ${foo} ${foo}`,
          },
        ]);
      });

      it('does not warn if pnpm excludes the updates', async () => {
        mockExecAll();
        mockPnpmFiles();

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '^11.0.0' } },
          [
            {
              ...update,
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: null,
              minimumReleaseAgeRepository: '1 day',
            },
          ],
        );

        expect(res.minimumReleaseAgeNotice).toBeUndefined();
      });

      it.each`
        name                                         | pnpm          | workspace                      | hoursAgo     | expected
        ${'a release as old as the workspace value'} | ${'^11.0.0'}  | ${'minimumReleaseAge: 2880\n'} | ${49}        | ${`${flag} ${foo} ${foo}`}
        ${'no release younger than the workspace'}   | ${'^11.0.0'}  | ${'minimumReleaseAge: 2880\n'} | ${24}        | ${flag}
        ${'no release younger than the v11 default'} | ${'^11.0.0'}  | ${undefined}                   | ${1}         | ${flag}
        ${'no release without a timestamp'}          | ${'^11.0.0'}  | ${undefined}                   | ${undefined} | ${flag}
        ${'a release without a pnpm value'}          | ${'~10.19.0'} | ${undefined}                   | ${undefined} | ${`${flag} ${foo} ${foo}`}
      `('excludes $name', async ({ pnpm, workspace, hoursAgo, expected }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(workspace);

        await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm } },
          [
            {
              ...update,
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: null,
              minimumReleaseAgeRepository: '3 days',
              releaseTimestamp:
                hoursAgo &&
                (new Date(
                  Date.now() - hoursAgo * 60 * 60 * 1000,
                ).toISOString() as Timestamp),
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} ${expected} --no-frozen-lockfile` },
        ]);
      });
    });

    const notice =
      'pnpm checked a minimum release age of 1440 minutes instead of 4320 for this update, because the `minimumReleaseAge` of `foo` is smaller. pnpm supports exact versions in `minimumReleaseAgeExclude` only since v10.19.0.';

    it.each`
      workspace                      | extracted         | expected     | minutes
      ${undefined}                   | ${undefined}      | ${notice}    | ${1440}
      ${'minimumReleaseAge: 4320\n'} | ${'4320 minutes'} | ${undefined} | ${4320}
    `(
      'lowers the minimum release age for updates with a smaller minimumReleaseAge: workspace=$workspace',
      async ({ workspace, extracted, expected, minutes }) => {
        const execSnapshots = mockExecAll();
        mockPnpmFiles(workspace);

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '~10.18.0' } },
          [
            { depName: 'foo', minimumReleaseAge: '1 day' },
            { depName: 'foo', minimumReleaseAge: '1 day' },
            { depName: 'bar', minimumReleaseAge: '3 days' },
          ].map((upgrade) => ({
            ...upgrade,
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            datasource: 'npm',
            minimumReleaseAgeExtracted: extracted,
            minimumReleaseAgeRepository: '3 days',
          })),
        );

        expect(res.minimumReleaseAgeNotice).toBe(expected);
        expect(execSnapshots).toMatchObject([
          {
            cmd: `${pnpmInstall} --config.minimum-release-age=${minutes} --no-frozen-lockfile`,
          },
        ]);
      },
    );

    it.each`
      name                                   | upgrade                                                                           | warns
      ${'a non-npm datasource'}              | ${{ datasource: 'node-version' }}                                                 | ${false}
      ${'a minimumReleaseAgeBuffer'}         | ${{ minimumReleaseAge: '2 days', minimumReleaseAgeBuffer: '1 day' }}              | ${true}
      ${'the same sub-minute value'}         | ${{ minimumReleaseAge: '90 seconds', minimumReleaseAgeRepository: '90 seconds' }} | ${true}
      ${'a version older than the cutoff'}   | ${{ releaseTimestamp: '2020-01-01T00:00:00.000Z' }}                               | ${false}
      ${'a version younger than the cutoff'} | ${{ releaseTimestamp: new Date().toISOString() }}                                 | ${true}
    `(
      'warns about the update with $name: $warns',
      async ({ upgrade, warns }) => {
        mockExecAll();
        mockPnpmFiles();

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '~10.18.0' } },
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'foo',
              datasource: 'npm',
              minimumReleaseAgeRepository: '3 days',
              ...upgrade,
            },
          ],
        );

        expect(!!res.minimumReleaseAgeNotice).toBe(warns);
      },
    );

    it.each`
      pnpm          | warns
      ${'^9.0.0'}   | ${false}
      ${'10.15.1'}  | ${false}
      ${'~10.16.0'} | ${true}
    `(
      'warns for pnpm $pnpm, which reads the minimum release age from v10.16.0: $warns',
      async ({ pnpm, warns }) => {
        mockExecAll();
        mockPnpmFiles();

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm } },
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'foo',
              datasource: 'npm',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(!!res.minimumReleaseAgeNotice).toBe(warns);
      },
    );

    it.each`
      exclude                   | upgrade                                          | warns
      ${'foo'}                  | ${{ depName: 'foo' }}                            | ${false}
      ${"'@scope/*'"}           | ${{ depName: 'bar', packageName: '@scope/foo' }} | ${false}
      ${"'*-plugin'"}           | ${{ depName: '@scope/a-plugin' }}                | ${false}
      ${"'foo@1.0.0 || 2.0.0'"} | ${{ depName: 'foo', newVersion: '2.0.0' }}       | ${false}
      ${"'foo@1.0.0'"}          | ${{ depName: 'foo', newVersion: '2.0.0' }}       | ${true}
      ${"'foo@1.0.0'"}          | ${{ depName: 'foo' }}                            | ${true}
      ${"'!foo'"}               | ${{ depName: 'bar' }}                            | ${false}
      ${"'!foo'"}               | ${{ depName: 'foo' }}                            | ${true}
      ${'bar'}                  | ${{ depName: 'foo' }}                            | ${true}
      ${'bar'}                  | ${{ depName: undefined }}                        | ${true}
    `(
      'warns about the update $upgrade with minimumReleaseAgeExclude $exclude: $warns',
      async ({ exclude, upgrade, warns }) => {
        mockExecAll();
        mockPnpmFiles(`minimumReleaseAgeExclude:\n  - ${exclude}\n`);

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, constraints: { pnpm: '~10.18.0' } },
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              datasource: 'npm',
              minimumReleaseAgeRepository: '3 days',
              ...upgrade,
            },
          ],
        );

        expect(!!res.minimumReleaseAgeNotice).toBe(warns);
      },
    );

    it('does not lower the minimum release age below the pnpm v11 default', async () => {
      mockExecAll();
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, constraints: { pnpm: '>=9' } },
        [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            depName: 'foo',
            datasource: 'npm',
            minimumReleaseAge: null,
            minimumReleaseAgeRepository: '1 day',
          },
        ],
      );

      expect(res.minimumReleaseAgeNotice).toBeUndefined();
    });

    it('lowers the minimum release age no further than the pnpm-workspace.yaml value', async () => {
      const execSnapshots = mockExecAll();
      mockPnpmFiles('minimumReleaseAge: 2880\n');

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, constraints: { pnpm: '~10.18.0' } },
        [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            depName: 'foo',
            datasource: 'npm',
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '3 days',
          },
        ],
      );

      expect(res.minimumReleaseAgeNotice).toStartWith(
        'pnpm checked a minimum release age of 2880 minutes instead of 4320',
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${pnpmInstall} --config.minimum-release-age=2880 --no-frozen-lockfile`,
        },
      ]);
    });

    it('keeps the notice if pnpm fails', async () => {
      mockExecSequence([immatureError('ERR_PNPM_FETCH_404  Not Found')]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, constraints: { pnpm: '~10.18.0' } },
        [
          {
            manager: 'npm',
            minimumReleaseAgePackageManagerSync: true,
            depName: 'foo',
            datasource: 'npm',
            minimumReleaseAgeRepository: '3 days',
          },
        ],
      );

      expect(res).toMatchObject({
        error: true,
        minimumReleaseAgeNotice: expect.stringContaining('`foo`'),
      });
    });

    it('does not retry if pnpm rejects locked packages and explains how to pass', async () => {
      const stdout =
        'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  foo@1.2.3 was published within the minimumReleaseAge cutoff';
      const execSnapshots = mockExecSequence([immatureError(stdout)]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
        {
          manager: 'npm',
          minimumReleaseAgePackageManagerSync: true,
          minimumReleaseAge: '3 days',
          minimumReleaseAgeRepository: '3 days',
        },
      ]);

      expect(res).toEqual({
        error: true,
        stderr: `The \`pnpm-lock.yaml\` contains packages younger than the minimum release age of 4320 minutes which Renovate passes to pnpm. Raise \`minimumReleaseAge\` in the \`pnpm-workspace.yaml\` to 4320, or set \`trustLockfile: true\` there (pnpm v11.3.0 or later) to skip this check.\n\n${stdout}`,
        stdout,
      });
      expect(execSnapshots).toHaveLength(1);
    });

    it('does not explain locked packages which pnpm rejects without a minimum release age from Renovate', async () => {
      const stdout =
        'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  foo@1.2.3 was published within the minimumReleaseAge cutoff';
      mockExecSequence([immatureError(stdout)]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
        { manager: 'npm', minimumReleaseAgePackageManagerSync: true },
      ]);

      expect(res).toEqual({ error: true, stderr: '', stdout });
    });

    it('does not retry on other errors', async () => {
      const execSnapshots = mockExecSequence([
        immatureError('ERR_PNPM_FETCH_404  Not Found'),
      ]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
        {
          manager: 'npm',
          minimumReleaseAgePackageManagerSync: true,
          minimumReleaseAge: '1 day',
          minimumReleaseAgeRepository: '1 day',
        },
      ]);

      expect(res).toEqual({
        error: true,
        stderr: '',
        stdout: 'ERR_PNPM_FETCH_404  Not Found',
      });
      expect(execSnapshots).toHaveLength(1);
    });

    it.each`
      name                       | upgrade
      ${'an update'}             | ${{}}
      ${'lock file maintenance'} | ${{ isLockFileMaintenance: true }}
    `(
      'does not retry for $name and names the packages',
      async ({ upgrade }) => {
        const stdout =
          'ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 1.2.3 (released 2 hours ago) of foo does not meet the minimumReleaseAge constraint';
        const execSnapshots = mockExecSequence([immatureError(stdout)]);
        mockPnpmFiles();

        const res = await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          config,
          [
            {
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '1 day',
              minimumReleaseAgeRepository: '1 day',
              ...upgrade,
            },
          ],
        );

        expect(res).toEqual({
          error: true,
          stderr: `pnpm found no version old enough for the minimum release age: \`foo@1.2.3\`\n\n${stdout}`,
          stdout,
        });
        expect(execSnapshots).toHaveLength(1);
      },
    );
  });

  describe('getImmaturePackages()', () => {
    it.each`
      output                                                                                                                                                                                                            | expected
      ${''}                                                                                                                                                                                                             | ${[]}
      ${'Version 1.2.3 (released 2 hours ago) of foo does not meet the minimumReleaseAge constraint'}                                                                                                                   | ${[]}
      ${'ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 1.2.3 (released 2 hours ago) of @scope/foo does not meet the minimumReleaseAge constraint'}                                                                       | ${['@scope/foo@1.2.3']}
      ${'ERR_PNPM_NO_MATURE_MATCHING_VERSION  No matching version found for foo@^1.0.0 published by Mon Jun 15 2026 while fetching it from https://registry.npmjs.org/'}                                                | ${['foo@^1.0.0']}
      ${'ERR_PNPM_NO_MATURE_MATCHING_VERSION  2 versions do not meet the minimumReleaseAge constraint:\n  @scope/bar@2.0.0 (released 1 hour ago)\n  foo@1.2.3 (released 2 hours ago)\n\nRun the install interactively'} | ${['@scope/bar@2.0.0', 'foo@1.2.3']}
      ${'ERR_PNPM_NO_MATURE_MATCHING_VERSION  1 version does not meet the minimumReleaseAge constraint:\n  foo@1.2.3 is too new'}                                                                                       | ${['foo@1.2.3']}
    `('returns $expected', ({ output, expected }) => {
      expect(pnpmHelper.getImmaturePackages(output)).toEqual(expected);
    });
  });

  describe('getConstraintsFromLockFile()', () => {
    it('returns null if no lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null when error reading lock file', async () => {
      fs.readLocalFile.mockRejectedValueOnce(new Error('foo'));
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null if no lockfileVersion', async () => {
      fs.readLocalFile.mockResolvedValueOnce('foo: bar\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null if lockfileVersion is not a number or numeric string', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: foo\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns default if lockfileVersion is 1', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: 1\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=3 <3.5.0');
    });

    it('maps supported versions', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: 5.3\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=6 <7');
    });

    it('maps supported versions for v6', async () => {
      fs.readLocalFile.mockResolvedValueOnce("lockfileVersion: '6.0'\n");
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=7.24.2 <9');
    });

    it('maps supported versions for v9', async () => {
      fs.readLocalFile.mockResolvedValueOnce("lockfileVersion: '9.0'\n");
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=9');
    });
  });
});
