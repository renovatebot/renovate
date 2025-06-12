import { codeBlock } from 'common-tags';
import { GlobalConfig } from '../../../../config/global';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeToolConstraint } from './node-version';
import * as pnpmHelper from './pnpm';
import { envMock, mockExecAll } from '~test/exec-util';
import { Fixtures } from '~test/fixtures';
import { env, fs, partial } from '~test/util';

vi.mock('../../../../util/exec/env');
vi.mock('../../../../util/fs');
vi.mock('./node-version');

delete process.env.NPM_CONFIG_CACHE;
process.env.CONTAINERBASE = 'true';

describe('modules/manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  const upgrades: Upgrade[] = [{}];

  beforeEach(() => {
    config = partial<PostUpdateConfig>({ constraints: { pnpm: '^2.0.0' } });
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '' });
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
    expect(execSnapshots).toMatchSnapshot();
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
    expect(execSnapshots).toMatchSnapshot();
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
    expect(execSnapshots).toMatchSnapshot();
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

  it('performs lock file updates for workspace with --recursive', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    fs.localPathExists.mockResolvedValueOnce(true); // pnpm-workspace.yaml
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
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile',
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
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
    expect(execSnapshots).toMatchSnapshot();
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
      {
        cmd: 'pnpm dedupe --config.ignore-scripts=true',
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
    expect(execSnapshots).toMatchSnapshot();
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          encoding: 'utf-8',
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          encoding: 'utf-8',
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          encoding: 'utf-8',
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
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
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
          '&& install-tool pnpm 6.0.0 ' +
          '&& pnpm install --lockfile-only' +
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
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
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
