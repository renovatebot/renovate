const { getInstalledPath } = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('../../../../lib/util/exec');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

/** @type any */
const fs = require('fs-extra');
/** @type any */
const { exec } = require('../../../../lib/util/exec');
const pnpmHelper = require('../../../../lib/manager/npm/post-update/pnpm');

describe('generateLockFile', () => {
  let env;
  let config;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir' };
  });
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('uses docker pnpm', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    config.binarySource = 'docker';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/pnpm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    });
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    config.binarySource = 'global';
    const res = await pnpmHelper.generateLockFile('some-dir', env, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
