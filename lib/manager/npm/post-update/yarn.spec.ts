import { exec as _exec } from 'child_process';
import {
  ExecSnapshots,
  envMock,
  mockExecAll,
} from '../../../../test/exec-util';
import { fs, mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import * as _yarnHelper from './yarn';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('./node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const yarnHelper = mocked(_yarnHelper);

delete process.env.NPM_CONFIG_CACHE;

// TODO: figure out snapshot similarity for each CI platform (#9617)
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));

describe('manager/npm/post-update/yarn', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
    ['3.0.0', '3.0.0', 1],
  ])(
    'generates lock files using yarn v%s',
    async (yarnVersion, yarnCompatibility, expectedFsCalls) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) =>
            resolve('yarn-path ./.yarn/cli.js\n')
          );
        }
        return new Promise<string>((resolve) =>
          resolve('package-lock-contents')
        );
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
        config
      );
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it('only skips build if skipInstalls is false', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '3.0.0',
      stderr: '',
    });
    fs.readFile.mockResolvedValueOnce('package-lock-contents');
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

  it('does not use global cache if zero install is detected', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '2.1.0',
      stderr: '',
    });
    fs.readFile.mockResolvedValueOnce('package-lock-contents');
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
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) => resolve(null));
        }
        return new Promise<string>((resolve) =>
          resolve('package-lock-contents')
        );
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
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([['1.22.0']])(
    'performs lock file updates and full install using yarn v%s',
    async (yarnVersion) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile
        .mockResolvedValueOnce(
          'yarn-offline-mirror ./npm-packages-offline-cache'
        )
        .mockResolvedValueOnce('package-lock-contents');
      const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
        {
          depName: 'some-dep',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
  ])(
    'performs lock file maintenance using yarn v%s',
    async (yarnVersion, yarnCompatibility, expectedFsCalls) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) => resolve(null));
        }
        return new Promise<string>((resolve) =>
          resolve('package-lock-contents')
        );
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
      expect(fs.remove).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([
    ['1.22.0', '^1.10.0'],
    ['2.1.0', '>= 2.0.0'],
  ])(
    'performs yarn binary update using yarn v%s',
    async (yarnVersion, yarnCompatibility) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) => resolve(null));
        }
        return new Promise<string>((resolve) =>
          resolve('package-lock-contents')
        );
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
    }
  );

  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '1.9.4',
      stderr: 'some-error',
    });
    fs.readFile.mockResolvedValueOnce(null).mockRejectedValueOnce(() => {
      throw new Error('not-found');
    });
    const res = await yarnHelper.generateLockFile('some-dir', {});
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  describe('checkYarnrc()', () => {
    it('returns offline mirror and yarn path', async () => {
      fs.exists.mockImplementation((path) => {
        if (path === './.yarn/cli.js') {
          return new Promise<boolean>((resolve) => resolve(true));
        }
        return new Promise<boolean>((resolve) => resolve(false));
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) =>
            resolve(
              'yarn-offline-mirror "./packages-cache"\nyarn-path "./.yarn/cli.js"\n'
            )
          );
        }
        return new Promise<string>((resolve) => resolve(''));
      });
      expect(await _yarnHelper.checkYarnrc('/tmp/renovate')).toEqual({
        offlineMirror: true,
        yarnPath: './.yarn/cli.js',
      });
    });

    it('returns no offline mirror and unquoted yarn path', async () => {
      fs.exists.mockImplementation((path) => {
        if (path === './.yarn/cli.js') {
          return new Promise<boolean>((resolve) => resolve(true));
        }
        return new Promise<boolean>((resolve) => resolve(false));
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) =>
            resolve('yarn-path ./.yarn/cli.js\n')
          );
        }
        return new Promise<string>((resolve) => resolve(''));
      });
      expect(await _yarnHelper.checkYarnrc('/tmp/renovate')).toEqual({
        offlineMirror: false,
        yarnPath: './.yarn/cli.js',
      });
    });

    it('returns offline mirror and no yarn path for non-existant yarn-path binary', async () => {
      let yarnrcContents = 'yarn-path ./.yarn/cli.js\n';
      fs.writeFile.mockImplementation((filename, fileContents) => {
        if (filename.endsWith('.yarnrc')) {
          yarnrcContents = fileContents;
        }
        return new Promise<void>((resolve) => resolve());
      });
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) => resolve(yarnrcContents));
        }
        return new Promise<string>((resolve) => resolve(''));
      });
      const { offlineMirror, yarnPath } = await _yarnHelper.checkYarnrc(
        '/tmp/renovate'
      );
      expect(offlineMirror).toBeFalse();
      expect(yarnPath).toBeNull();
      expect(yarnrcContents).not.toContain('yarn-path');
    });
  });
});
