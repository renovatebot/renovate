import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import { platform as _platform } from '../../../lib/platform';
import { updateArtifacts } from '../../../lib/manager/mix';
import { mocked } from '../../util';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const platform = mocked(_platform);

jest.mock('fs-extra');
jest.mock('child_process');
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
    platform.getFile.mockResolvedValueOnce('Current mix.lock');
    exec.mockImplementationOnce((cmd, _options, callback) => {
      callback(null, '', '');
      return undefined;
    });
    fs.readFile.mockResolvedValueOnce('Current mix.lock' as any);
    expect(await updateArtifacts('mix.exs', ['plug'], '', config)).toBeNull();
  });
  it('returns updated mix.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Old mix.lock');
    let dockerCommand = null;
    exec.mockImplementationOnce((cmd, _options, callback) => {
      dockerCommand = cmd;
      callback(null, '', '');
      return undefined;
    });
    fs.readFile.mockResolvedValueOnce('New mix.lock' as any);
    expect(
      await updateArtifacts('mix.exs', ['plug'], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).toMatchSnapshot();
    expect(dockerCommand.replace(/\\(\w)/g, '/$1')).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current mix.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts('mix.exs', ['plug'], '{}', config)
    ).toMatchSnapshot();
  });
});
