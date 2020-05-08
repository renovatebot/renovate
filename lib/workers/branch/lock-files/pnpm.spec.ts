import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { getInstalledPath as _getInstalledPath } from 'get-installed-path';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { mocked } from '../../../../test/util';
import { PostUpdateConfig } from '../../../manager/common';
import * as _pnpmHelper from '../../../manager/npm/post-update/pnpm';
import { BinarySource } from '../../../util/exec/common';
import * as _env from '../../../util/exec/env';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('get-installed-path');

const getInstalledPath: jest.Mock<string> = _getInstalledPath as never;
getInstalledPath.mockImplementation(() => null);

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);

describe('generateLockFile', () => {
  let config: PostUpdateConfig;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir' };
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses docker pnpm', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = BinarySource.Docker;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds pnpm embedded in renovate', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(
      () => '/node_modules/renovate/node_modules/pnpm'
    );
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds pnpm globally', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses fallback pnpm', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = BinarySource.Global;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
