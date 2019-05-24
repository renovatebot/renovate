jest.mock('fs-extra');
jest.mock('child-process-promise');
jest.mock('../../../lib/util/host-rules');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const pipenv = require('../../../lib/manager/pipenv/artifacts');

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  afterEach(() => {
    delete global.trustLevel;
  });
  it('returns if no Pipfile.lock found', async () => {
    expect(await pipenv.getArtifacts('Pipfile', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: 'Locking',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current Pipfile.lock');
    expect(await pipenv.getArtifacts('Pipfile', [], '{}', config)).toBeNull();
  });
  it('returns updated Pipfile.lock', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['Pipfile.lock'] });
    fs.readFile = jest.fn(() => 'New Pipfile.lock');
    global.trustLevel = 'high';
    expect(
      await pipenv.getArtifacts('Pipfile', [], '{}', config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['Pipfile.lock'] });
    fs.readFile = jest.fn(() => 'New Pipfile.lock');
    expect(
      await pipenv.getArtifacts('Pipfile', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.getArtifacts('Pipfile', [], '{}', config)
    ).toMatchSnapshot();
  });
});
