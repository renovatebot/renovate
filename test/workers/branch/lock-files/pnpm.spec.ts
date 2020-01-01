import { getInstalledPath } from 'get-installed-path';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import { mocked } from '../../../util';
import * as _pnpmHelper from '../../../../lib/manager/npm/post-update/pnpm';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const exec: jest.Mock<typeof _exec> = _exec as any;
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
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('uses docker pnpm', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = 'docker';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
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
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
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
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
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
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\/g, '/'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    config.binarySource = 'global';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
