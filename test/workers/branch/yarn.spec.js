const yarnHelper = require('../../../lib/workers/branch/yarn');
const logger = require('../../_fixtures/logger');
const { getInstalledPath } = require('get-installed-path');

jest.mock('fs-extra');
jest.mock('child-process-promise');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);

const fs = require('fs-extra');
const { exec } = require('child-process-promise');

describe('generateLockFile', () => {
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/yarn');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents');
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(lockFile).toEqual('package-lock-contents');
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
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(lockFile).toBe(null);
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
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(lockFile).toEqual('package-lock-contents');
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
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(lockFile).toEqual('package-lock-contents');
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
    const lockFile = await yarnHelper.generateLockFile('some-dir', logger);
    expect(fs.readFile.mock.calls.length).toEqual(1);
    expect(lockFile).toEqual('package-lock-contents');
  });
});
