const yarnHelper = require('../../../lib/workers/branch/yarn');
const logger = require('../../_fixtures/logger');

jest.mock('fs-extra');
jest.mock('child_process');

const fs = require('fs-extra');
const cp = require('child_process');

const tmpDir = { name: 'some-dir' };

describe('generateLockFile', () => {
  fs.outputFile = jest.fn();
  fs.readFileSync = jest.fn(() => 'yarn-lock-contents');
  cp.spawnSync = jest.fn(() => ({
    stdout: '',
    stderror: '',
  }));
  it('generates lock files', async () => {
    const yarnLock = await yarnHelper.generateLockFile(
      tmpDir.name,
      {},
      'npmrc-contents',
      'yarnrc-contents',
      logger
    );
    expect(fs.outputFile.mock.calls.length).toEqual(3);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(yarnLock).toEqual('yarn-lock-contents');
  });
});
describe('getLockFile', () => {
  let api;
  beforeEach(() => {
    api = {
      getFileContent: jest.fn(),
    };
  });
  it('returns null if no existing yarn.lock', async () => {
    api.getFileContent.mockReturnValueOnce(false);
    expect(
      await yarnHelper.getLockFile(tmpDir, 'package.json', '', api, '')
    ).toBe(null);
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
    expect(
      await yarnHelper.getLockFile(tmpDir, 'package.json', '', api, '')
    ).toMatchObject(yarnLockFile);
  });
});

describe('maintainLockFile', () => {
  let config;
  beforeEach(() => {
    config = { logger };
    config.packageFile = 'package.json';
    config.api = {
      getFileContent: jest.fn(),
    };
    config.tmpDir = tmpDir;
    config.api.getFileContent.mockReturnValueOnce('oldPackageContent');
    yarnHelper.getLockFile = jest.fn();
  });
  it('returns null if no file to maintain', async () => {
    const yarnLock = await yarnHelper.maintainLockFile(config);
    expect(config.api.getFileContent.mock.calls.length).toBe(3);
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
