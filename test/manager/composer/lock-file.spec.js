jest.mock('fs-extra');
jest.mock('child-process-promise');
jest.mock('dockerode');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const composer = require('../../../lib/manager/composer/lock-file');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getLockFile()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no composer.lock found', async () => {
    expect(
      await composer.getLockFile('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current composer.lock');
    expect(
      await composer.getLockFile('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('returns updated composer.lock', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    expect(
      await composer.getLockFile('composer.json', [], '{}', config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.readFile = jest.fn(() => 'New composer.lock');
    expect(
      await composer.getLockFile('composer.json', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    expect(
      await composer.getLockFile('composer.json', [], '{}', config)
    ).toBeNull();
  });
});
