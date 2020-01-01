import { getInstalledPath } from 'get-installed-path';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as _yarnHelper from '../../../../lib/manager/npm/post-update/yarn';
import { mocked } from '../../../util';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const exec: jest.Mock<typeof _exec> = _exec as any;
const fs = mocked(_fs);
const yarnHelper = mocked(_yarnHelper);

let processEnv;

describe('generateLockFile', () => {
  beforeEach(() => {
    delete process.env.YARN_MUTEX_FILE;
    jest.resetAllMocks();

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
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(
        cmd
          .replace(/\\(\w)/g, '/$1')
          .replace(/^node .*?bin\/yarn.*?\.js /, 'node bin/yarn.js ')
      );
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    /** @type {NodeJS.ProcessEnv} */
    const env = {};
    const config = {
      postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
    };
    const res = await yarnHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('performs lock file updates', async () => {
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(
        cmd
          .replace(/\\(\w)/g, '/$1')
          .replace(/^node .*?bin\/yarn.*?\.js /, 'node bin/yarn.js ')
      );
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    getInstalledPath.mockReturnValueOnce('node_modules/yarn');

    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    process.env.YARN_MUTEX_FILE = '/tmp/yarn.mutext';
    const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('detects yarnIntegrity', async () => {
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const config = {
      upgrades: [{ yarnIntegrity: true }],
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: 'some-error' });
      return undefined;
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('finds yarn embedded in renovate', async () => {
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(
      () => '/node_modules/renovate/node_modules/yarn'
    );
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('finds yarn globally', async () => {
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/yarn');
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('uses fallback yarn', async () => {
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
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
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await yarnHelper.generateLockFile('some-dir', undefined, {
      binarySource: 'global',
    });
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
});
