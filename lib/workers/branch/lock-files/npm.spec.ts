import { exec as _exec } from 'child_process';
import path from 'path';
import _fs from 'fs-extra';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { mocked } from '../../../../test/util';
import * as npmHelper from '../../../manager/npm/post-update/npm';
import { BinarySource } from '../../../util/exec/common';
import * as _env from '../../../util/exec/env';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../util/exec/env');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);

describe('generateLockFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const postUpdateOptions = ['npmDedupe'];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, postUpdateOptions }
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const updates = [
      { depName: 'some-dep', toVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls },
      updates
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.pathExists.mockImplementationOnce(() => true);
    fs.move = jest.fn();
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json')
    );
    expect(fs.move).toHaveBeenCalledTimes(1);
    expect(fs.move).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json'),
      path.join('some-dir', 'npm-shrinkwrap.json')
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(
      path.join('some-dir', 'npm-shrinkwrap.json'),
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.pathExists.mockImplementationOnce(() => false);
    fs.move = jest.fn();
    fs.readFile = jest.fn((_, _1) => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json')
    );
    expect(fs.move).toHaveBeenCalledTimes(0);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(
      path.join('some-dir', 'npm-shrinkwrap.json'),
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs full install', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = false;
    const binarySource = BinarySource.Global;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, binarySource }
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds npm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses docker npm', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource: BinarySource.Docker }
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
