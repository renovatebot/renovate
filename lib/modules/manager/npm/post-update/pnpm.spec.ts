import { codeBlock } from 'common-tags';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
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

  describe('minimumReleaseAge', () => {
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
          { ...config, minimumReleaseAge },
          upgrades,
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
          { ...config, constraints: { pnpm }, minimumReleaseAge },
          upgrades,
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

        await pnpmHelper.generateLockFile(
          'some-folder',
          {},
          { ...config, minimumReleaseAge },
          [upgrade],
        );

        expect(execSnapshots).toMatchObject([
          { cmd: `${pnpmInstall} --no-frozen-lockfile` },
        ]);
      },
    );

    it('does not retry if pnpm rejects locked packages', async () => {
      const stdout =
        'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  foo@1.2.3 was published within the minimumReleaseAge cutoff';
      const execSnapshots = mockExecSequence([immatureError(stdout)]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, minimumReleaseAge: '1 day' },
        upgrades,
      );

      expect(res).toEqual({ error: true, stderr: '', stdout });
      expect(execSnapshots).toHaveLength(1);
    });

    it('does not retry on other errors', async () => {
      const execSnapshots = mockExecSequence([
        immatureError('ERR_PNPM_FETCH_404  Not Found'),
      ]);
      mockPnpmFiles();

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        { ...config, minimumReleaseAge: '1 day' },
        upgrades,
      );

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
          { ...config, minimumReleaseAge: '1 day' },
          [upgrade],
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
