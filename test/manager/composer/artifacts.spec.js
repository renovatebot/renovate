jest.mock('fs-extra');
jest.mock('child-process-promise');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const composer = require('../../../lib/manager/composer/artifacts');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no composer.lock found', async () => {
    expect(
      await composer.getArtifacts('composer.json', [], '{}', config)
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
      await composer.getArtifacts('composer.json', [], '{}', config)
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
      await composer.getArtifacts('composer.json', [], '{}', config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    expect(
      await composer.getArtifacts('composer.json', [], '{}', {
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
      await composer.getArtifacts('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('throws unmet-requirements', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error(
        'fooYour requirements could not be resolved to an installable set of packages.bar'
      );
    });
    await expect(
      composer.getArtifacts('composer.json', [], '{}', config)
    ).rejects.toThrow();
  });
});
