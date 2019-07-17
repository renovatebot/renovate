jest.mock('fs-extra');
jest.mock('child-process-promise');

/** @type any */
const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const poetry = require('../../../lib/manager/poetry/artifacts');

/** @type any */
const platform = global.platform;

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  afterEach(() => {
    delete global.trustLevel;
  });
  it('returns null if no poetry.lock found', async () => {
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await poetry.updateArtifacts('pyproject.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await poetry.updateArtifacts('pyproject.toml', [], '', config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current poetry.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current poetry.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await poetry.updateArtifacts('pyproject.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns updated poetry.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old poetry.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New poetry.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    global.trustLevel = 'high';
    expect(
      await poetry.updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current poetry.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await poetry.updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});
