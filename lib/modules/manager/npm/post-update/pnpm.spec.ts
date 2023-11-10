import { envMock, mockExecAll } from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import { env, fs, mockedFunction, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { PostUpdateConfig } from '../../types';
import { getNodeToolConstraint } from './node-version';
import * as pnpmHelper from './pnpm';

jest.mock('../../../../util/exec/env');
jest.mock('../../../../util/fs');
jest.mock('./node-version');

delete process.env.NPM_CONFIG_CACHE;
process.env.CONTAINERBASE = 'true';

describe('modules/manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;

  beforeEach(() => {
    config = partial<PostUpdateConfig>({ constraints: { pnpm: '^2.0.0' } });
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '' });
    mockedFunction(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
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
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --recursive --lockfile-only --ignore-scripts --ignore-pnpmfile',
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
        cmd: 'pnpm install --recursive --lockfile-only --ignore-scripts --ignore-pnpmfile',
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
        cmd: 'pnpm install --recursive --lockfile-only --ignore-scripts --ignore-pnpmfile',
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
          '&& pnpm install --recursive --lockfile-only' +
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
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --recursive --lockfile-only --ignore-scripts --ignore-pnpmfile',
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

    it('returns null if lockfileVersion is not a number', async () => {
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
  });
});
