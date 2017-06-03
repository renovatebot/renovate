const yarnHelper = require('../../lib/helpers/yarn');
const defaultConfig = require('../../lib/config/defaults').getConfig();

jest.mock('fs');
jest.mock('child_process');
jest.mock('tmp');

const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');

describe('generateLockFile(newPackageJson, npmrcContent, yarnrcContent)', () => {
  tmp.dirSync = jest.fn(() => ({ name: 'somedir' }));
  fs.writeFileSync = jest.fn();
  fs.readFileSync = jest.fn(() => 'yarn-lock-contents');
  cp.spawnSync = jest.fn(() => ({
    stdout: '',
    stderror: '',
  }));
  it('generates lock files', async () => {
    const yarnLock = await yarnHelper.generateLockFile(
      'package-json-contents',
      'npmrc-contents',
      'yarnrc-contents',
      '/tmp/yarn-cache'
    );
    expect(tmp.dirSync.mock.calls.length).toEqual(1);
    expect(fs.writeFileSync.mock.calls.length).toEqual(3);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(yarnLock).toEqual('yarn-lock-contents');
  });
});
describe('getLockFile(packageJson, config)', () => {
  let api;
  beforeEach(() => {
    api = {
      getFileContent: jest.fn(),
    };
  });
  it('returns null if no existing yarn.lock', async () => {
    api.getFileContent.mockReturnValueOnce(false);
    expect(await yarnHelper.getLockFile('package.json', '', api)).toBe(null);
  });
  it('returns yarn.lock file', async () => {
    api.getFileContent.mockReturnValueOnce('Existing yarn.lock');
    api.getFileContent.mockReturnValueOnce(null); // npmrc
    api.getFileContent.mockReturnValueOnce(null); // yarnrc
    yarnHelper.generateLockFile = jest.fn();
    yarnHelper.generateLockFile.mockReturnValueOnce('New yarn.lock');
    const yarnLockFile = {
      name: 'yarn.lock',
      contents: 'New yarn.lock',
    };
    expect(await yarnHelper.getLockFile('package.json', '', api)).toMatchObject(
      yarnLockFile
    );
  });
});

describe('maintainLockFile(inputConfig)', () => {
  let config;
  beforeEach(() => {
    config = Object.assign({}, defaultConfig);
    config.packageFile = 'package.json';
    config.api = {
      getFileContent: jest.fn(),
    };
    config.api.getFileContent.mockReturnValueOnce('oldPackageContent');
    yarnHelper.getLockFile = jest.fn();
  });
  it('returns null if no file to maintain', async () => {
    const yarnLock = await yarnHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(yarnLock).toEqual(null);
  });
  it('returns null if contents match', async () => {
    config.api.getFileContent.mockReturnValueOnce('oldYarnLockContent');
    yarnHelper.getLockFile.mockReturnValueOnce({
      contents: 'oldYarnLockContent',
    });
    const yarnLock = await yarnHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(yarnLock).toEqual(null);
  });
  it('returns new yarn lock if contents differ', async () => {
    config.api.getFileContent.mockReturnValueOnce('oldYarnLockContent');
    yarnHelper.getLockFile.mockReturnValueOnce({
      contents: 'newYarnLockContent',
    });
    const yarnLock = await yarnHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(2);
    expect(yarnLock).toEqual({ contents: 'newYarnLockContent' });
  });
});
