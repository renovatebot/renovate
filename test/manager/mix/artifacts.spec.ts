import _fs from 'fs-extra';
import { exec as _exec } from '../../../lib/util/exec';
import { platform as _platform } from '../../../lib/platform';
import { updateArtifacts } from '../../../lib/manager/mix';

const fs: any = _fs;
const exec: any = _exec;
const platform: any = _platform;

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/platform');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns null if no mix.lock found', async () => {
    expect(await updateArtifacts('mix.exs', ['plug'], '', config)).toBeNull();
  });
  it('returns null if no updatedDeps were provided', async () => {
    expect(await updateArtifacts('mix.exs', [], '', config)).toBeNull();
  });
  it('returns null if no local directory found', async () => {
    const noLocalDirConfig = {
      localDir: null,
    };
    expect(
      await updateArtifacts('mix.exs', ['plug'], '', noLocalDirConfig)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await updateArtifacts('mix.exs', ['plug'], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current mix.lock');
    exec.mockReturnValue({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockReturnValueOnce('Current mix.lock');
    expect(await updateArtifacts('mix.exs', ['plug'], '', config)).toBeNull();
  });
  it('returns updated mix.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old mix.lock');
    exec.mockReturnValue({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockImplementationOnce(() => 'New mix.lock');
    expect(
      await updateArtifacts('mix.exs', ['plug'], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current mix.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts('mix.exs', ['plug'], '{}', config)
    ).toMatchSnapshot();
  });
});
