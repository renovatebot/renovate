import { getInstalledPath } from 'get-installed-path';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import { mocked } from '../../../util';
import * as _pnpmHelper from '../../../../lib/manager/npm/post-update/pnpm';
import { mockExecAll } from '../../../execUtil';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const exec: jest.Mock<typeof _exec> = _exec as any;
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);

let processEnv;

describe('generateLockFile', () => {
  let env;
  let config;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir' };

    processEnv = process.env;
    process.env = {
      HTTP_PROXY: 'http://example.com',
      HTTPS_PROXY: 'https://example.com',
      NO_PROXY: 'localhost',
      HOME: '/home/user',
      PATH: '/tmp/path',
    };
  });
  afterEach(() => {
    process.env = processEnv;
  });
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses docker pnpm', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = 'docker';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
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
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
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
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
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
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
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
    config.binarySource = 'global';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
