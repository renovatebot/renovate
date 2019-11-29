import _fs from 'fs-extra';
import { exec as _exec } from '../../../lib/util/exec';
import { platform as _platform } from '../../../lib/platform';
import { updateArtifacts } from '../../../lib/manager/cocoapods';

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
  it('returns null if no Podfile.lock found', async () => {
    expect(await updateArtifacts('Podfile', ['foo'], '', config)).toBeNull();
  });
  it('returns null if no updatedDeps were provided', async () => {
    expect(await updateArtifacts('Podfile', [], '', config)).toBeNull();
  });
  it('returns null for invalid local directory', async () => {
    const noLocalDirConfig = {
      localDir: undefined,
    };
    expect(
      await updateArtifacts('Podfile', ['foo'], '', noLocalDirConfig)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await updateArtifacts('Podfile', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current Podfile');
    exec.mockReturnValue({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockReturnValueOnce('Current Podfile');
    expect(await updateArtifacts('Podfile', ['foo'], '', config)).toBeNull();
  });
  it('returns updated Podfile', async () => {
    platform.getFile.mockReturnValueOnce('Old Podfile');
    exec.mockReturnValue({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockImplementationOnce(() => 'New Podfile');
    expect(
      await updateArtifacts('Podfile', ['foo'], '', {
        ...config,
        binarySource: 'docker',
      })
    ).toMatchSnapshot();
  });
  it('catches write error', async () => {
    platform.getFile.mockReturnValueOnce('Current Podfile');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('catches read error', async () => {
    platform.getFile.mockReturnValueOnce('Current Podfile');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockImplementationOnce(() => {
      throw new Error('read error');
    });
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('returns pod exec error', async () => {
    exec.mockImplementationOnce(() => {
      throw new Error('exec exception');
    });
    platform.getFile.mockReturnValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockImplementationOnce(() => 'Old Podfile.lock');
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('returns pod exec stderr', async () => {
    exec.mockReturnValue({
      stdout: '',
      stderr: 'Something happened',
    });
    platform.getFile.mockReturnValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockImplementationOnce(() => 'Old Podfile.lock');
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('does not return stderr if lockfile has changed', async () => {
    exec.mockReturnValue({
      stdout: '',
      stderr: 'Just a warning',
    });
    platform.getFile.mockReturnValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockImplementationOnce(() => 'New Podfile.lock');
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('falls back to the `latest` Docker image tag', async () => {
    let firstCommand = '';
    let secondCommand = '';

    platform.getFile.mockReturnValueOnce('COCOAPODS: 1.2.3.4');
    exec.mockImplementationOnce(cmd => {
      firstCommand = cmd;
      throw new Error('Unable to find image');
    });
    exec.mockImplementationOnce(cmd => {
      secondCommand = cmd;
      return {
        stdout: '',
        stderr: '',
      };
    });
    fs.readFile.mockImplementationOnce(() => 'New Podfile');
    await updateArtifacts('Podfile', ['foo'], '', {
      ...config,
      binarySource: 'docker',
    });
    expect(firstCommand).toContain('renovate/cocoapods:1.2.3.4');
    expect(secondCommand).toContain('renovate/cocoapods:latest');
    expect(exec).toBeCalledTimes(2);
  });
});
