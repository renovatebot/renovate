import { getInstalledPath } from 'get-installed-path';
import _fs from 'fs-extra';
import * as _exec from '../../../../lib/util/exec';
import * as _yarnHelper from '../../../../lib/manager/npm/post-update/yarn';
import { mocked } from '../../../util';

jest.mock('fs-extra');
jest.mock('../../../../lib/util/exec');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const exec = mocked(_exec).exec;
const fs = mocked(_fs);
const yarnHelper = mocked(_yarnHelper);

describe('generateLockFile', () => {
  beforeEach(() => {
    delete process.env.YARN_MUTEX_FILE;
    jest.resetAllMocks();
    exec.mockResolvedValue({
      stdout: '',
      stderr: '',
    });
  });
  it('generates lock files', async () => {
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
  });
  it('performs lock file updates', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');

    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    process.env.YARN_MUTEX_FILE = '/tmp/yarn.mutext';
    const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('detects yarnIntegrity', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const config = {
      upgrades: [{ yarnIntegrity: true }],
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
  });
  it('finds yarn embedded in renovate', async () => {
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
  });
  it('finds yarn globally', async () => {
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
  });
  it('uses fallback yarn', async () => {
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
  });
});
