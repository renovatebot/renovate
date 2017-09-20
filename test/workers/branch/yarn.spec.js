const yarnHelper = require('../../../lib/workers/branch/yarn');
const logger = require('../../_fixtures/logger');
const getInstalledPath = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const fs = require('fs-extra');
const cp = require('child_process');

describe('generateLockFile', () => {
  it('generates lock files', async () => {
    cp.spawnSync = jest.fn(() => ({
      stdout: '',
      stderror: '',
    }));
    fs.readFileSync = jest.fn(() => 'yarn-lock-contents');
    const yarnLock = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(yarnLock).toEqual('yarn-lock-contents');
  });
  it('catches and throws errors', async () => {
    cp.spawnSync = jest.fn(() => ({
      stdout: '',
      stderror: 'some-error',
    }));
    fs.readFileSync = jest.fn(() => {
      throw new Error('not found');
    });
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(lockFile).toBe(null);
  });
});
