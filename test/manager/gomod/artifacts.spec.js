jest.mock('fs-extra');
jest.mock('child-process-promise');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const gomod = require('../../../lib/manager/gomod/artifacts');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no go.sum found', async () => {
    expect(await gomod.getArtifacts('go.mod', [], '{}', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current go.sum');
    expect(await gomod.getArtifacts('go.mod', [], '{}', config)).toBeNull();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(await gomod.getArtifacts('go.mod', [], '{}', config)).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.getArtifacts('go.mod', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    fs.outputFile = jest.fn(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.getArtifacts('go.mod', [], '{}', config)
    ).toMatchSnapshot();
  });
});
