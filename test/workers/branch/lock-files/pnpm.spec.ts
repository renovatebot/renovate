import { getInstalledPath } from 'get-installed-path';
import _fs from 'fs-extra';
import * as _exec from '../../../../lib/util/exec';
import { mocked } from '../../../util';
import * as _pnpmHelper from '../../../../lib/manager/npm/post-update/pnpm';

jest.mock('fs-extra');
jest.mock('../../../../lib/util/exec');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const exec = mocked(_exec).exec;
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);

describe('generateLockFile', () => {
  let env;
  let config;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir' };
  });
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('uses docker pnpm', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = 'docker';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
  });
  it('finds pnpm embedded in renovate', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(
      () => '/node_modules/renovate/node_modules/pnpm'
    );
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
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
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
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
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = 'global';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
