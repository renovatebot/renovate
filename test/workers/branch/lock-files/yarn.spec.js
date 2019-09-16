const { getInstalledPath } = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('../../../../lib/util/exec');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

/** @type any */
const fs = require('fs-extra');
/** @type any */
const { exec } = require('../../../../lib/util/exec');
const yarnHelper = require('../../../../lib/manager/npm/post-update/yarn');

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
    fs.readFile = jest.fn(() => 'package-lock-contents');
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

    fs.readFile = jest.fn(() => 'package-lock-contents');
    process.env.YARN_MUTEX_FILE = '/tmp/yarn.mutext';
    const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('detects yarnIntegrity', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    fs.readFile = jest.fn(() => 'package-lock-contents');
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderr: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    });
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
    fs.readFile = jest.fn(() => 'package-lock-contents');
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
    fs.readFile = jest.fn(() => 'package-lock-contents');
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
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir', undefined, {
      binarySource: 'global',
    });
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
