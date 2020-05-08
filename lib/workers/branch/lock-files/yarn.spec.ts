import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { ExecSnapshots, envMock, mockExecAll } from '../../../../test/execUtil';
import { getName, mocked } from '../../../../test/util';
import * as _yarnHelper from '../../../manager/npm/post-update/yarn';
import { BinarySource } from '../../../util/exec/common';
import * as _env from '../../../util/exec/env';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../util/exec/env');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const yarnHelper = mocked(_yarnHelper);

// TODO: figure out snapshot similarity for each CI platform
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));

describe(getName(__filename), () => {
  beforeEach(() => {
    delete process.env.YARN_MUTEX_FILE;
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it.each([['1.0.0'], ['2.0.0']])(
    'generates lock files using yarn v%s',
    async (yarnVersion) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      fs.readFile = jest.fn(() => 'package-lock-contents') as never;
      const config = {
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toEqual('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );
  it.each([['1.0.0'], ['2.0.0']])(
    'performs lock file updates using yarn v%s',
    async (yarnVersion) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });

      fs.readFile = jest.fn(() => 'package-lock-contents') as never;
      process.env.YARN_MUTEX_FILE = '/tmp/yarn.mutext';
      const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
        { depName: 'some-dep', isLockfileUpdate: true },
      ]);
      expect(res.lockFile).toEqual('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );
  it.each([['1.0.0'], ['2.0.0']])(
    'docker using yarn v%s',
    async (yarnVersion) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });

      fs.readFile = jest.fn(() => 'package-lock-contents') as never;
      const config = {
        upgrades: [{ yarnIntegrity: true }],
        binarySource: BinarySource.Docker,
        cacheDir: 'dummy/dir',
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        { depName: 'some-dep', isLockfileUpdate: true },
      ]);
      expect(res.lockFile).toEqual('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '1.9.4',
      stderr: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it.each([['1.0.0'], ['2.0.0']])(
    'finds yarn v%s globally',
    async (yarnVersion) => {
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });

      fs.readFile = jest.fn(() => 'package-lock-contents') as never;
      const res = await yarnHelper.generateLockFile('some-dir');
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toEqual('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );
});
