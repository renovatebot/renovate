const { getInstalledPath } = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('child-process-promise');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const yarnHelper = require('../../../../lib/manager/npm/post-update/yarn');

describe('generateLockFile', () => {
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs lock file updates', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
      { depName: 'some-dep', isLockfileUpdate: true },
    ]);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    });
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile.mock.calls.length).toEqual(1);
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile.mock.calls.length).toEqual(1);
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir');
    expect(fs.readFile.mock.calls.length).toEqual(1);
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
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await yarnHelper.generateLockFile('some-dir', undefined, {
      binarySource: 'global',
    });
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
