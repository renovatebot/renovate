const { getInstalledPath } = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('child-process-promise');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const npmHelper = require('../../../../lib/manager/npm/post-update/npm');

describe('generateLockFile', () => {
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      skipInstalls
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.error).not.toBeDefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs lock file updates', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const skipInstalls = true;
    const updates = [
      { depName: 'some-dep', toVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      skipInstalls,
      null,
      updates
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.error).not.toBeDefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs full install', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      skipInstalls,
      binarySource
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.error).not.toBeDefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    });
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
  });
  it('finds npm embedded in renovate', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(
      () => '/node_modules/renovate/node_modules/npm'
    );
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('finds npm globally', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/npm');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('uses fallback npm', async () => {
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
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
