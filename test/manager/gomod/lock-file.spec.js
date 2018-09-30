jest.mock('fs-extra');
jest.mock('child-process-promise');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const gomod = require('../../../lib/manager/gomod/lock-file');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getLockFile()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no go.sum found', async () => {
    expect(await gomod.getLockFile('gomod.json', [], '{}', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current go.sum');
    expect(await gomod.getLockFile('gomod.json', [], '{}', config)).toBeNull();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.getLockFile('gomod.json', [], '{}', config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.getLockFile('gomod.json', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    expect(await gomod.getLockFile('gomod.json', [], '{}', config)).toBeNull();
  });
});
