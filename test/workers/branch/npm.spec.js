const npmHelper = require('../../../lib/workers/branch/npm');
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
    fs.readFileSync = jest.fn(() => 'package-lock-contents');
    const lockFile = await npmHelper.generateLockFile('some-dir', logger);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    cp.spawnSync = jest.fn(() => ({
      stdout: '',
      stderror: 'some-error',
    }));
    fs.readFileSync = jest.fn(() => {
      throw new Error('not found');
    });
    const lockFile = await npmHelper.generateLockFile('some-dir', logger);
    expect(fs.readFileSync.mock.calls.length).toEqual(1);
    expect(lockFile).toBe(null);
  });
});
