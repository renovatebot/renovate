import upath from 'upath';
import { envMock, mockExecAll } from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import { env, fs, mockedFunction } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { getNodeToolConstraint } from './node-version';
import * as npmHelper from './npm';

jest.mock('../../../../util/exec/env');
jest.mock('../../../../util/fs');
jest.mock('./node-version');

process.env.CONTAINERBASE = 'true';

describe('modules/manager/npm/post-update/npm', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '' });
    mockedFunction(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('{}');
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
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
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
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
    expect(execSnapshots).toMatchSnapshot();
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
    expect(res.lockFile).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
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
    expect(fs.renameLocalFile).toHaveBeenCalledWith(
      upath.join('some-dir', 'package-lock.json'),
      upath.join('some-dir', 'npm-shrinkwrap.json'),
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
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
    expect(fs.readLocalFile).toHaveBeenCalledWith(
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
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
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
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toHaveLength(1);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'npm install --package-lock-only --no-audit --prefer-dedupe --ignore-scripts',
      },
    ]);
  });

  it('deduplicates dependencies after installation with npm <= 6', async () => {
    const execSnapshots = mockExecAll();
    // package.json
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { postUpdateOptions, constraints: { npm: '^6.0.0' } },
      updates,
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeFalse();
    expect(res.lockFile).toBe('package-lock-contents');
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
    // package.json
    fs.readLocalFile.mockResolvedValue('{}');
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    // TODO: is that right?
    expect(execSnapshots).toEqual([]);
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
    expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('works for docker mode', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'docker',
      allowScripts: true,
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
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
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp":"/tmp" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "some-dir" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool node 16.16.0 ' +
          '&& ' +
          'install-tool npm 6.0.0 ' +
          '&& ' +
          'hash -d npm 2>/dev/null || true ' +
          '&& ' +
          'npm install --package-lock-only --no-audit' +
          '"',
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
      { cmd: 'hash -d npm 2>/dev/null || true' },
      {
        cmd: 'npm install --package-lock-only --no-audit --ignore-scripts',
      },
    ]);
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
      expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/a abbrev@1.1.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=web/b xmldoc@2.2.0 hello@1.1.1',
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
      expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=docs/a abbrev@1.1.0 hello@1.1.1',
        },
        {
          cmd: 'npm install --package-lock-only --no-audit --ignore-scripts --workspace=web/b xmldoc@2.2.0 hello@1.1.1',
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
        ],
        workspaces: new Set(['docs/a', 'web/b']),
        rootDeps: new Set(['chalk@9.4.8', 'postcss@8.4.8']),
      });
    });
  });
});
