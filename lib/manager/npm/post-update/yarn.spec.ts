import { exec as _exec } from 'child_process';
import {
  ExecSnapshots,
  envMock,
  mockExecAll,
} from '../../../../test/exec-util';
import { fs, getName, mocked } from '../../../../test/util';
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

// TODO: figure out snapshot similarity for each CI platform
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it.each([
    ['1.22.0', '^1.10.0', 2],
    ['2.1.0', '>= 2.0.0', 1],
    ['2.2.0', '2.2.0', 1],
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
      const res = await yarnHelper.generateLockFile('some-dir', {}, config);
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(res.lockFile).toEqual('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );
  it.each([['1.22.0'], ['2.1.0']])(
    'performs lock file updates using yarn v%s',
    async (yarnVersion) => {
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
          yarn: yarnVersion === '1.22.0' ? '^1.10.0' : '>= 2.0.0',
        },
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        {
          depName: 'some-dep',
          newValue: '^1.0.0',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toEqual('package-lock-contents');
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
      expect(res.lockFile).toEqual('package-lock-contents');
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
      expect(res.lockFile).toEqual('package-lock-contents');
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
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });
  describe('checkYarnrc()', () => {
    it('returns offline mirror and yarn path', async () => {
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
      expect(await _yarnHelper.checkYarnrc('/tmp/renovate')).toMatchSnapshot();
    });
    it('returns no offline mirror and unquoted yarn path', async () => {
      fs.readFile.mockImplementation((filename, encoding) => {
        if (filename.endsWith('.yarnrc')) {
          return new Promise<string>((resolve) =>
            resolve('yarn-path ./.yarn/cli.js\n')
          );
        }
        return new Promise<string>((resolve) => resolve(''));
      });
      expect(await _yarnHelper.checkYarnrc('/tmp/renovate')).toMatchSnapshot();
    });
  });
});
