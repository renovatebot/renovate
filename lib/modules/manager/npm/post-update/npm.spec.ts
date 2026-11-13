import upath from 'upath';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import { getNodeToolConstraint } from './node-version.ts';
import * as npmHelper from './npm.ts';

vi.mock('../../../../util/exec/env.ts');
vi.mock('../../../../util/fs/index.ts');
vi.mock('./node-version.ts');

process.env.CONTAINERBASE = 'true';

describe('modules/manager/npm/post-update/npm', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '', binarySource: 'global' });
    vi.mocked(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const packageLockContents = JSON.stringify({
      packages: {},
      lockfileVersion: 3,
    });
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    const skipInstalls = true;
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, postUpdateOptions },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe(packageLockContents);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --prefer-dedupe --ignore-scripts',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('runs npm install twice', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const packageLockContents = JSON.stringify({
      packages: {},
      lockfileVersion: 3,
    });
    fs.readLocalFile
      .mockResolvedValueOnce(packageLockContents)
      .mockResolvedValueOnce(packageLockContents);
    const skipInstalls = true;
    const postUpdateOptions = ['npmInstallTwice'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, postUpdateOptions },
      updates,
    );
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = true;
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, constraints: { npm: '^6.0.0' } },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts some-dep@1.0.1',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('performs lock file updates retaining the package.json counterparts', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(
      Fixtures.get('update-lockfile-massage-1/package-lock.json'),
    );
    const skipInstalls = true;
    const updates = [
      {
        packageName: 'postcss',
        depType: 'dependencies',
        newVersion: '8.4.8',
        newValue: '^8.0.0',
        isLockfileUpdate: true,
        managerData: {}, // intentional: edge-case test for workspaces
      },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, constraints: { npm: '^6.0.0' } },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeFalse();
    // the lock file update is applied to the "dependencies" section while the
    // package.json counterpart in the "packages" section is retained
    const lockFile = JSON.parse(res.lockFile!);
    expect(lockFile.packages['']).toEqual({
      name: 'update-lockfile-massage-1',
      version: '1.0.0',
      dependencies: { postcss: '^8.0.0' },
    });
    expect(lockFile.dependencies.postcss.version).toBe('8.4.8');
    expect(lockFile.packages['node_modules/postcss'].version).toBe('8.4.31');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts postcss@8.4.8',
        options: { cwd: 'some-dir' },
      },
    ]);
  });

  it('performs npm-shrinkwrap.json updates', async () => {
    const execSnapshots = mockExecAll();
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls, constraints: { npm: '^6.0.0' } },
    );
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.renameLocalFile).toHaveBeenCalledExactlyOnceWith(
      upath.join('some-dir', 'package-lock.json'),
      upath.join('some-dir', 'npm-shrinkwrap.json'),
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledExactlyOnceWith(
      'some-dir/npm-shrinkwrap.json',
      'utf8',
    );
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    // TODO: is that right?
    expect(execSnapshots).toEqual([]);
  });

  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls, constraints: { npm: '^6.0.0' } },
    );
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(0);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledExactlyOnceWith(
      'some-dir/npm-shrinkwrap.json',
      'utf8',
    );
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    // TODO: is that right?
    expect(execSnapshots).toEqual([]);
  });

  it('performs full install', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, binarySource, constraints: { npm: '^6.0.0' } },
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    // TODO: is that right?
    expect(execSnapshots).toEqual([]);
  });

  it('deduplicates dependencies on installation with npm >= 7', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const packageLockContents = JSON.stringify({
      dependencies: {},
      lockfileVersion: 2,
    });
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { postUpdateOptions },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe(packageLockContents);
    expect(execSnapshots).toHaveLength(1);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --prefer-dedupe --ignore-scripts',
      },
    ]);
  });

  it('deduplicates package-lock.json dependencies after installation with npm <= 6', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const packageLockContents = JSON.stringify({
      dependencies: {},
      lockfileVersion: 1,
    });
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { postUpdateOptions },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe(packageLockContents);
    expect(execSnapshots).toHaveLength(2);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm dedupe',
      },
    ]);
  });

  it('deduplicates npm-shrinkwrap.json dependencies after installation with npm <= 6', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const packageLockContents = JSON.stringify({
      dependencies: {},
      lockfileVersion: 1,
    });
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    fs.readLocalFile.mockResolvedValueOnce(packageLockContents);
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { postUpdateOptions },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);

    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'some-dir/npm-shrinkwrap.json',
      'utf8',
    );
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe(packageLockContents);
    expect(execSnapshots).toHaveLength(2);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm dedupe',
      },
    ]);
  });

  it('runs twice if remediating', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource, constraints: { npm: '^6.0.0' } },
      [{ isRemediation: true }],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toHaveLength(2);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toEqual([]);
  });

  it('finds npm globally', async () => {
    const execSnapshots = mockExecAll();
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    // package.json
    fs.readLocalFile.mockResolvedValue('{}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      {},
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.lockFile).toBe('package-lock-contents');
    // since there are no install npm commands, it means we are using the global npm
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('uses docker npm', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource: 'docker', constraints: { npm: '^6.0.0' } },
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    // TODO: is that right?
    expect(execSnapshots).toEqual([]);
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValue('{}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      {},
      [{ isLockFileMaintenance: true }],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('does not run npm install four times for lock file maintenance with npmInstallTwice', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValue('{}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { postUpdateOptions: ['npmInstallTwice'] },
      [{ isLockFileMaintenance: true }],
    );
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
        options: { cwd: 'some-dir' },
      },
    ]);
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
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { constraints: { npm: '6.0.0' } },
      [{ isLockFileMaintenance: true }],
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
          '&& ' +
          'install-tool npm 6.0.0 ' +
          '&& ' +
          'npm install --package-lock-only --no-audit ' +
          '&& ' +
          'npm install --package-lock-only --no-audit' +
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
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { constraints: { npm: '6.0.0' } },
      [{ isLockFileMaintenance: true }],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool npm 6.0.0' },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('does not install npm if no constraints specified', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { constraints: {} },
      [{ isLockFileMaintenance: true }],
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('falls back to the extracted npm constraint', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { extractedConstraints: { npm: '6.0.0' } },
      [{ isLockFileMaintenance: true }],
    );
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool npm 6.0.0' },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  it('prefers the derived npm constraint over the extracted one', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{"packageManager":"npm@8.0.0"}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { extractedConstraints: { npm: '6.0.0' } },
      [{ isLockFileMaintenance: true }],
    );
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool npm 8.0.0' },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
  });

  describe('passes NODE_OPTIONS', () => {
    it('if nodeMaxMemory set on global config', async () => {
      GlobalConfig.set({
        localDir: '',
        toolSettings: {
          nodeMaxMemory: 3456,
        },
        binarySource: 'global',
      });

      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const packageLockContents = JSON.stringify({
        packages: {},
        lockfileVersion: 3,
      });
      fs.readLocalFile
        .mockResolvedValueOnce(packageLockContents)
        .mockResolvedValueOnce(packageLockContents);
      const skipInstalls = true;
      const updates = [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: false,
        },
      ];
      await npmHelper.generateLockFile(
        'some-dir',
        {},
        'package-lock.json',
        { skipInstalls },
        updates,
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=3456',
      );
    });

    it('if nodeMaxMemory set on repo config', async () => {
      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const packageLockContents = JSON.stringify({
        packages: {},
        lockfileVersion: 3,
      });
      fs.readLocalFile
        .mockResolvedValueOnce(packageLockContents)
        .mockResolvedValueOnce(packageLockContents);
      const skipInstalls = true;
      const updates = [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: false,
        },
      ];
      await npmHelper.generateLockFile(
        'some-dir',
        {},
        'package-lock.json',
        {
          skipInstalls,
          toolSettings: {
            nodeMaxMemory: 3456,
          },
        },
        updates,
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=3456',
      );
    });
  });

  describe('installs workspace only packages separately', () => {
    const updates = [
      {
        packageFile: 'some-dir/docs/a/package.json',
        packageName: 'abbrev',
        depType: 'dependencies',
        newVersion: '1.1.0',
        newValue: '^1.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/web/b/package.json',
        packageName: 'xmldoc',
        depType: 'dependencies',
        newVersion: '2.2.0',
        newValue: '^2.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/docs/a/package.json',
        packageName: 'postcss',
        depType: 'dependencies',
        newVersion: '8.4.8',
        newValue: '^8.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/package.json',
        packageName: 'chalk',
        depType: 'dependencies',
        newVersion: '9.4.8',
        newValue: '^9.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/web/b/package.json',
        packageName: 'postcss',
        depType: 'dependencies',
        newVersion: '8.4.8',
        newValue: '^8.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/package.json',
        packageName: 'postcss',
        depType: 'dependencies',
        newVersion: '8.4.8',
        newValue: '^8.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/web/b/package.json',
        packageName: 'hello',
        depType: 'dependencies',
        newVersion: '1.1.1',
        newValue: '^1.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/docs/a/package.json',
        packageName: 'hello',
        depType: 'dependencies',
        newVersion: '1.1.1',
        newValue: '^1.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-dir/docs/dir.has.period/package.json',
        packageName: 'hello',
        depType: 'dependencies',
        newVersion: '1.1.1',
        newValue: '^1.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
      {
        packageFile: 'some-missing-dir/docs/a/package.json',
        packageName: 'hello',
        depType: 'dependencies',
        newVersion: '1.1.1',
        newValue: '^1.0.0',
        isLockfileUpdate: true,
        managerData: {
          workspacesPackages: ['docs/*', 'web/*'],
        },
      },
    ];

    it('workspace in sub-folder', async () => {
      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValue('{}');
      fs.readLocalFile.mockResolvedValueOnce('package-lock content');
      const skipInstalls = true;
      const res = await npmHelper.generateLockFile(
        'some-dir',
        {},
        'package-lock.json',
        { skipInstalls },
        updates,
      );
      expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/a abbrev@1.1.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=web/b xmldoc@2.2.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/dir.has.period hello@1.1.1',
        },

        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts chalk@9.4.8 postcss@8.4.8',
        },
      ]);
    });

    it('workspace in root folder', async () => {
      const modifiedUpdates = updates.map((update) => {
        return {
          ...update,
          packageFile: update.packageFile.replace('some-dir/', ''),
        };
      });
      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValue('{}');
      fs.readLocalFile.mockResolvedValueOnce('package-lock content');
      const skipInstalls = true;
      const res = await npmHelper.generateLockFile(
        '.',
        {},
        'package-lock.json',
        { skipInstalls },
        modifiedUpdates,
      );
      expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/a abbrev@1.1.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=web/b xmldoc@2.2.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/dir.has.period hello@1.1.1',
        },

        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts chalk@9.4.8 postcss@8.4.8',
        },
      ]);
      expect(
        npmHelper.divideWorkspaceAndRootDeps('.', modifiedUpdates),
      ).toMatchObject({
        lockRootUpdates: [
          {
            packageFile: 'package.json',
            packageName: 'chalk',
            depType: 'dependencies',
            newVersion: '9.4.8',
            newValue: '^9.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
          },
          {
            packageFile: 'package.json',
            packageName: 'postcss',
            depType: 'dependencies',
            newVersion: '8.4.8',
            newValue: '^8.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
          },
        ],
        lockWorkspacesUpdates: [
          {
            packageFile: 'docs/a/package.json',
            packageName: 'abbrev',
            depType: 'dependencies',
            newVersion: '1.1.0',
            newValue: '^1.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'docs/a',
          },
          {
            packageFile: 'web/b/package.json',
            packageName: 'xmldoc',
            depType: 'dependencies',
            newVersion: '2.2.0',
            newValue: '^2.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'web/b',
          },
          {
            packageFile: 'docs/a/package.json',
            packageName: 'postcss',
            depType: 'dependencies',
            newVersion: '8.4.8',
            newValue: '^8.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'docs/a',
          },
          {
            packageFile: 'web/b/package.json',
            packageName: 'postcss',
            depType: 'dependencies',
            newVersion: '8.4.8',
            newValue: '^8.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'web/b',
          },
          {
            packageFile: 'web/b/package.json',
            packageName: 'hello',
            depType: 'dependencies',
            newVersion: '1.1.1',
            newValue: '^1.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'web/b',
          },
          {
            packageFile: 'docs/a/package.json',
            packageName: 'hello',
            depType: 'dependencies',
            newVersion: '1.1.1',
            newValue: '^1.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'docs/a',
          },
          {
            packageFile: 'docs/dir.has.period/package.json',
            packageName: 'hello',
            depType: 'dependencies',
            newVersion: '1.1.1',
            newValue: '^1.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
            workspace: 'docs/dir.has.period',
          },
        ],
        workspaces: new Set(['docs/a', 'web/b', 'docs/dir.has.period']),
        rootDeps: new Set(['chalk@9.4.8', 'postcss@8.4.8']),
      });
    });
  });

  describe('prevents injections', () => {
    it('while performing lockfileUpdate (npm-workspaces)', async () => {
      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValue('{}');
      fs.readLocalFile.mockResolvedValueOnce('package-lock content');
      const skipInstalls = true;
      const res = await npmHelper.generateLockFile(
        'some-dir',
        {},
        'package-lock.json',
        { skipInstalls },
        [
          {
            packageFile: 'some-dir/web/b/package.json',
            packageName: ' && echo "hi";',
            depType: 'dependencies',
            newVersion: '2.2.0',
            newValue: '^2.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
          },
          {
            packageFile: 'some-dir/docs/a || date; /package.json',
            packageName: 'hello',
            depType: 'dependencies',
            newVersion: '1.1.1',
            newValue: '^1.0.0',
            isLockfileUpdate: true,
            managerData: {
              workspacesPackages: ['docs/*', 'web/*'],
            },
          },
        ],
      );
      expect(fs.readLocalFile).toHaveBeenCalledTimes(3);
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        {
          cmd: `npm install --package-lock-only --no-audit --ignore-scripts --workspace=web/b ' && echo "hi";@2.2.0'`,
        },
        {
          cmd: `npm install --package-lock-only --no-audit --ignore-scripts --workspace='docs/a || date; ' hello@1.1.1`,
        },
      ]);
    });

    it('while performing lockfileUpdate (npm)', async () => {
      const execSnapshots = mockExecAll();
      // package.json
      fs.readLocalFile.mockResolvedValue('{}');
      fs.readLocalFile.mockResolvedValue('package-lock-contents');
      await npmHelper.generateLockFile(
        'some-dir',
        {},
        'package-lock.json',
        {},
        [
          {
            depName: 'uuid',
            currentVersion: '^11.0.0',
            newVersion: '11.1.0',
            packageName: '; date; echo ',
            isLockfileUpdate: true,
          },
        ],
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: "npm install --package-lock-only --no-audit --ignore-scripts '; date; echo @11.1.0'",
        },
      ]);
    });
  });

  describe('--before with minimumReleaseAge', () => {
    let execSnapshots: ReturnType<typeof mockExecAll>;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
      execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const packageLockContents = JSON.stringify({
        packages: {},
        lockfileVersion: 3,
      });
      fs.readLocalFile
        .mockResolvedValueOnce(packageLockContents)
        .mockResolvedValueOnce(packageLockContents);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('without minimumReleaseAgePackageManagerSync', () => {
      it('sets --before from minimumReleaseAge', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(res.beforeFallback).toBeFalse();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before on unparseable minimumReleaseAge', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: 'invalid garbage' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('uses stricter npmrc before date when older than minimumReleaseAge', async () => {
        // npmrc (June 1) is earlier than minimumReleaseAge (3 days = June 12)
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'registry=https://registry.npmjs.org\nbefore=2026-06-01T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-01T00:00:00.000Z',
          },
        ]);
      });

      it('uses minimumReleaseAge date when stricter than npmrc before date', async () => {
        // minimumReleaseAge (3 days = June 12) is earlier than npmrc (June 14)
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'before=2026-06-14T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before when minimumReleaseAge is absent even if npmrc has before', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'before=2026-06-01T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('skips --before when .npmrc has min-release-age to avoid npm conflict', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'min-release-age=30\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('skips --before when .npmrc has a min-release-age with a unit', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'min-release-age=7d\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('sets --before to now for a minimumReleaseAge of 0 days', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '0 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-15T12:00:00.000Z',
          },
        ]);
      });

      it('retries without --before on ETARGET with "with a date before"', async () => {
        const etargetError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@1.2.3 with a date before 6/12/2026, 12:00:00 PM.',
          options: {},
        });
        const packageLockContents = JSON.stringify({
          packages: {},
          lockfileVersion: 3,
        });
        execSnapshots = mockExecSequence([
          etargetError,
          { stdout: '', stderr: '' },
        ]);
        fs.readLocalFile
          .mockResolvedValueOnce(packageLockContents)
          .mockResolvedValueOnce(packageLockContents);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(res.beforeFallback).toBeTrue();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('does not retry on non-before ETARGET errors', async () => {
        const otherError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@999.999.999.',
          options: {},
        });
        execSnapshots = mockExecSequence([otherError]);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
        );

        expect(res.error).toBeTrue();
        expect(res.beforeFallback).toBeUndefined();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('ignores the minimumReleaseAge of the updates and retries lock file maintenance without --before on ETARGET', async () => {
        const etargetError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@1.2.3 with a date before 6/12/2026, 12:00:00 PM.',
          options: {},
        });
        execSnapshots = mockExecSequence([
          etargetError,
          { stdout: '', stderr: '' },
        ]);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              manager: 'npm',
              depName: 'some-dep',
              isLockFileMaintenance: true,
              minimumReleaseAge: '1 day',
              minimumReleaseAgeRepository: '14 days',
              minimumReleaseAgePackageManagerSync: false,
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(res.beforeFallback).toBeTrue();
        expect(res.minimumReleaseAgeNotice).toBeUndefined();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });
    });

    describe('with minimumReleaseAgePackageManagerSync', () => {
      it('sets --before from minimumReleaseAge', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(res.beforeFallback).toBeFalse();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('uses the repository minimumReleaseAge over a larger packageRules one', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '14 days' },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '2.0.0',
              isLockfileUpdate: false,
              minimumReleaseAge: '14 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before without a repository minimumReleaseAge', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true, minimumReleaseAge: '3 days' },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('skips --before for security updates', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              isVulnerabilityAlert: true,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('uses the own minimumReleaseAge of lock file maintenance', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              isLockFileMaintenance: true,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '1 day',
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('falls back to lock file maintenance of the package file in the branch upgrades', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          {
            skipInstalls: true,
            manager: 'pip_requirements',
            minimumReleaseAgeRepository: '14 days',
            upgrades: [
              {
                datasource: 'npm',
                manager: 'npm',
                minimumReleaseAgePackageManagerSync: true,
                packageFile: 'other-dir/package.json',
                isLockFileMaintenance: true,
                minimumReleaseAge: '1 day',
              },
              {
                datasource: 'npm',
                manager: 'npm',
                minimumReleaseAgePackageManagerSync: true,
                packageFile: 'some-dir/package.json',
                isLockFileMaintenance: true,
                minimumReleaseAge: '3 days',
              },
            ],
          },
          [{ packageName: 'some-dep', newVersion: '1.0.1' }],
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('lowers --before to the smaller minimumReleaseAge of a young update', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'some-dep',
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '1 day',
              minimumReleaseAgeRepository: '3 days',
              releaseTimestamp: '2026-06-13T12:00:00.000Z' as Timestamp,
            },
          ],
        );

        expect(res.minimumReleaseAgeNotice).toBe(
          'npm checked a minimum release age of 1 day instead of 3 days for this update, because the `minimumReleaseAge` of `some-dep` is smaller. npm has no per-package exclude for `--before`.',
        );
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-14T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before for a young update without minimumReleaseAge', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'mycorp-lib',
              packageName: 'mycorp-lib',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: null,
              minimumReleaseAgePackageManager: '3 days',
            },
          ],
        );

        expect(res.minimumReleaseAgeNotice).toBe(
          'npm checked no minimum release age instead of 3 days for this update, because the `minimumReleaseAge` of `mycorp-lib` is smaller. npm has no per-package exclude for `--before`.',
        );
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('keeps --before for a young update of another datasource', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'node-version',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'node',
              newVersion: '24.0.0',
              isLockfileUpdate: false,
              minimumReleaseAge: null,
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(res.minimumReleaseAgeNotice).toBeUndefined();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('keeps --before for an update older than minimumReleaseAgeRepository', async () => {
        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              depName: 'some-dep',
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '1 day',
              minimumReleaseAgeRepository: '3 days',
              releaseTimestamp: '2026-06-01T00:00:00.000Z' as Timestamp,
            },
          ],
        );

        expect(res.minimumReleaseAgeNotice).toBeUndefined();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it.each`
        npmrcBefore                   | minimumReleaseAge | notice                                                          | before
        ${'2026-06-10T00:00:00.000Z'} | ${'1 day'}        | ${undefined}                                                    | ${'2026-06-10T00:00:00.000Z'}
        ${'2026-06-13T00:00:00.000Z'} | ${'1 day'}        | ${'the `before` date 2026-06-13T00:00:00.000Z of the `.npmrc`'} | ${'2026-06-13T00:00:00.000Z'}
        ${'2026-06-14T18:00:00.000Z'} | ${'1 day'}        | ${'a minimum release age of 1 day'}                             | ${'2026-06-14T12:00:00.000Z'}
        ${'2026-06-13T00:00:00.000Z'} | ${null}           | ${'the `before` date 2026-06-13T00:00:00.000Z of the `.npmrc`'} | ${null}
      `(
        'lowers --before no further than the npmrc before date $npmrcBefore for minimumReleaseAge $minimumReleaseAge',
        async ({ npmrcBefore, minimumReleaseAge, notice, before }) => {
          const res = await npmHelper.generateLockFile(
            'some-dir',
            {},
            'package-lock.json',
            { skipInstalls: true },
            [
              {
                datasource: 'npm',
                manager: 'npm',
                minimumReleaseAgePackageManagerSync: true,
                depName: 'some-dep',
                packageName: 'some-dep',
                newVersion: '1.0.1',
                isLockfileUpdate: false,
                minimumReleaseAge,
                minimumReleaseAgeRepository: '3 days',
                releaseTimestamp: '2026-06-14T00:00:00.000Z' as Timestamp,
              },
            ],
            `before=${npmrcBefore}\n`,
          );

          expect(res.minimumReleaseAgeNotice).toBe(
            notice &&
              `npm checked ${notice} instead of 3 days for this update, because the \`minimumReleaseAge\` of \`some-dep\` is smaller. npm has no per-package exclude for \`--before\`.`,
          );
          expect(execSnapshots).toMatchObject([
            {
              cmd: `npm install --package-lock-only --no-audit --ignore-scripts${before ? ` --before=${before}` : ''}`,
            },
          ]);
        },
      );

      it('uses stricter npmrc before date when older than minimumReleaseAge', async () => {
        // npmrc (June 1) is earlier than minimumReleaseAge (3 days = June 12)
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          'registry=https://registry.npmjs.org\nbefore=2026-06-01T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-01T00:00:00.000Z',
          },
        ]);
      });

      it('uses minimumReleaseAge date when stricter than npmrc before date', async () => {
        // minimumReleaseAge (3 days = June 12) is earlier than npmrc (June 14)
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          'before=2026-06-14T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before when minimumReleaseAge is absent even if npmrc has before', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
            },
          ],
          'before=2026-06-01T00:00:00.000Z\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('sets --before when .npmrc has a min-release-age with a unit, which npm ignores', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          'min-release-age=7d\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('skips --before when .npmrc has min-release-age to avoid npm conflict', async () => {
        await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          'min-release-age=30\n',
        );

        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('retries without --before on ETARGET with "with a date before"', async () => {
        const etargetError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@1.2.3 with a date before 6/12/2026, 12:00:00 PM.',
          options: {},
        });
        const packageLockContents = JSON.stringify({
          packages: {},
          lockfileVersion: 3,
        });
        execSnapshots = mockExecSequence([
          etargetError,
          { stdout: '', stderr: '' },
        ]);
        fs.readLocalFile
          .mockResolvedValueOnce(packageLockContents)
          .mockResolvedValueOnce(packageLockContents);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(res.error).toBeFalse();
        expect(res.beforeFallback).toBeTrue();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
          },
        ]);
      });

      it('does not retry on non-before ETARGET errors', async () => {
        const otherError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@999.999.999.',
          options: {},
        });
        execSnapshots = mockExecSequence([otherError]);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              packageName: 'some-dep',
              newVersion: '1.0.1',
              isLockfileUpdate: false,
              minimumReleaseAge: '3 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
        );

        expect(res.error).toBeTrue();
        expect(res.beforeFallback).toBeUndefined();
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          },
        ]);
      });

      it('returns an error on ETARGET from --before for lock file maintenance', async () => {
        const etargetError = new ExecError('npm error code ETARGET', {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --before=2026-06-12T12:00:00.000Z',
          stdout: '',
          stderr:
            'npm error code ETARGET\nnpm error notarget No matching version found for @scope/pkg@1.2.3 with a date before 6/12/2026, 12:00:00 PM.',
          options: {},
        });
        execSnapshots = mockExecSequence([etargetError]);

        const res = await npmHelper.generateLockFile(
          'some-dir',
          {},
          'package-lock.json',
          { skipInstalls: true },
          [
            {
              datasource: 'npm',
              manager: 'npm',
              minimumReleaseAgePackageManagerSync: true,
              isLockFileMaintenance: true,
              minimumReleaseAge: '3 days',
            },
          ],
        );

        expect(res).toEqual({
          error: true,
          stderr: etargetError.stderr,
        });
        expect(execSnapshots).toHaveLength(1);
      });
    });
  });
});
