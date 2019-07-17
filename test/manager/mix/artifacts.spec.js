jest.mock('fs-extra');
jest.mock('child-process-promise');

/** @type any */
const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const mix = require('../../../lib/manager/mix/artifacts');

/** @type any */
const platform = global.platform;

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns null if no mix.lock found', async () => {
    const updatedDeps = [
      {
        depName: 'plug',
        currentValue: '1.6.0',
      },
    ];
    expect(
      await mix.getArtifacts('mix.exs', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns null if no local directory found', async () => {
    const updatedDeps = [
      {
        depName: 'plug',
        currentValue: '1.6.0',
      },
    ];
    const noLocalDirConfig = {
      localDir: null,
    };
    expect(
      await mix.getArtifacts('mix.exs', updatedDeps, '', noLocalDirConfig)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await mix.getArtifacts('mix.exs', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current mix.lock');
    exec.mockReturnValue({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current mix.lock');
    const updatedDeps = [
      {
        depName: 'plug',
        currentValue: '1.6.0',
      },
    ];
    expect(
      await mix.getArtifacts('mix.exs', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns updated mix.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old mix.lock');
    exec.mockReturnValue({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New mix.lock');
    const updatedDeps = [
      {
        depName: 'plug',
        currentValue: '1.6.0',
      },
    ];
    expect(
      await mix.getArtifacts('mix.exs', updatedDeps, '{}', config)
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current mix.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'plug',
        currentValue: '1.6.0',
      },
    ];
    expect(
      await mix.getArtifacts('mix.exs', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});
