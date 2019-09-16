import _fs from 'fs-extra';
import { exec as _exec } from '../../../lib/util/exec';
import { platform as _platform } from '../../../lib/platform';
import { getArtifacts } from '../../../lib/manager/mix';

const fs: any = _fs;
const exec: any = _exec;
const platform: any = _platform;

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/platform');

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
    expect(await getArtifacts('mix.exs', updatedDeps, '', config)).toBeNull();
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
      await getArtifacts('mix.exs', updatedDeps, '', noLocalDirConfig)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await getArtifacts('mix.exs', [], '', config)).toBeNull();
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
    expect(await getArtifacts('mix.exs', updatedDeps, '', config)).toBeNull();
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
      await getArtifacts('mix.exs', updatedDeps, '{}', config)
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
      await getArtifacts('mix.exs', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});
