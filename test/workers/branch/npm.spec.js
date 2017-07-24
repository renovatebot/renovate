const npmHelper = require('../../../lib/workers/branch/npm');

jest.mock('fs');
jest.mock('child_process');
jest.mock('tmp');

const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');

describe('generateLockFile(newPackageJson, npmrcContent)', () => {
  tmp.dirSync = jest.fn(() => ({ name: 'somedir' }));
  fs.writeFileSync = jest.fn();
  fs.readFileSync = jest.fn(() => 'package-lock-contents');
  cp.spawnSync = jest.fn(() => ({
    stdout: '',
    stderror: '',
  }));
  it('generates lock files', async () => {
    const packageLock = await npmHelper.generateLockFile(
      'package-json-contents',
      'npmrc-contents'
    );
    expect(tmp.dirSync.mock.calls.length).toEqual(1);
    expect(fs.writeFileSync.mock.calls.length).toEqual(2);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(packageLock).toEqual('package-lock-contents');
  });
});
describe('getLockFile(packageJson, config)', () => {
  let api;
  beforeEach(() => {
    api = {
      getFileContent: jest.fn(),
    };
  });
  it('returns null if no existing package-lock.json', async () => {
    api.getFileContent.mockReturnValueOnce(false);
    expect(await npmHelper.getLockFile('package.json', '', api)).toBe(null);
  });
  it('returns package-lock.json file', async () => {
    api.getFileContent.mockReturnValueOnce('Existing package-lock.json');
    api.getFileContent.mockReturnValueOnce(null); // npmrc
    npmHelper.generateLockFile = jest.fn();
    npmHelper.generateLockFile.mockReturnValueOnce('New package-lock.json');
    const packageLockFile = {
      name: 'package-lock.json',
      contents: 'New package-lock.json',
    };
    expect(
      await npmHelper.getLockFile('package.json', '', api, '5.0.4')
    ).toMatchObject(packageLockFile);
  });
  it('throws if no npm', async () => {
    api.getFileContent.mockReturnValueOnce('Existing package-lock.json');
    let e;
    try {
      await npmHelper.getLockFile('package.json', '', api, '');
    } catch (err) {
      e = err;
    }
    expect(e).toMatchSnapshot();
  });
  it('throws if wrong npm version', async () => {
    api.getFileContent.mockReturnValueOnce('Existing package-lock.json');
    let e;
    try {
      await npmHelper.getLockFile('package.json', '', api, '4.0.0');
    } catch (err) {
      e = err;
    }
    expect(e).toMatchSnapshot();
  });
});

describe('maintainLockFile(inputConfig)', () => {
  let config;
  beforeEach(() => {
    config = {};
    config.packageFile = 'package.json';
    config.api = {
      getFileContent: jest.fn(),
    };
    config.versions = {
      npm: '5.3.0',
    };
    config.api.getFileContent.mockReturnValueOnce('oldPackageContent');
    npmHelper.getLockFile = jest.fn();
  });
  it('returns null if no file to maintain', async () => {
    const packageLock = await npmHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(packageLock).toEqual(null);
  });
  it('returns null if contents match', async () => {
    config.api.getFileContent.mockReturnValueOnce('oldPackageLockContent');
    npmHelper.getLockFile.mockReturnValueOnce({
      contents: 'oldPackageLockContent',
    });
    const packageLock = await npmHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(packageLock).toEqual(null);
  });
  it('returns new package lock if contents differ', async () => {
    config.api.getFileContent.mockReturnValueOnce('oldPackageLockContent');
    npmHelper.getLockFile.mockReturnValueOnce({
      contents: 'newPackageLockContent',
    });
    const packageLock = await npmHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(packageLock).toEqual({ contents: 'newPackageLockContent' });
  });
});
