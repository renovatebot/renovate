import _fs from 'fs-extra';
import * as _exec from '../../../lib/util/exec';
import { platform as _platform } from '../../../lib/platform';
import { updateArtifacts } from '../../../lib/manager/cocoapods';
import * as _datasource from '../../../lib/datasource';
import { mocked } from '../../util';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec = mocked(_exec).exec;
const platform = mocked(_platform);
const datasource = mocked(_datasource);

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/platform');
jest.mock('../../../lib/datasource');

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
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockResolvedValueOnce('Current Podfile' as any);
    expect(await updateArtifacts('Podfile', ['foo'], '', config)).toBeNull();
  });
  it('returns updated Podfile', async () => {
    platform.getFile.mockResolvedValueOnce('Old Podfile');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    expect(
      await updateArtifacts('Podfile', ['foo'], '', {
        ...config,
        binarySource: 'docker',
      })
    ).toMatchSnapshot();
  });
  it('catches write error', async () => {
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('catches read error', async () => {
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    fs.outputFile.mockResolvedValueOnce(null as never);
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
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    fs.readFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('returns pod exec stderr', async () => {
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Something happened',
    });
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('does not return stderr if lockfile has changed', async () => {
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Just a warning',
    });
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockResolvedValueOnce('New Podfile.lock' as any);
    expect(
      await updateArtifacts('Podfile', ['foo'], '', config)
    ).toMatchSnapshot();
  });
  it('dynamically selects Docker image tag', async () => {
    let command = '';

    platform.getFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '1.2.0' },
        { version: '1.2.1' },
        { version: '1.2.2' },
        { version: '1.2.3' },
        { version: '1.2.4' },
        { version: '1.2.5' },
      ],
    });
    exec.mockImplementationOnce(cmd => {
      command = cmd;
      return Promise.resolve({
        stdout: '',
        stderr: '',
      });
    });
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    await updateArtifacts('Podfile', ['foo'], '', {
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });
    expect(command).toContain('renovate/cocoapods:1.2.4');
    expect(command).toContain('user=ubuntu');
    expect(exec).toBeCalledTimes(1);
  });
  it('falls back to the `latest` Docker image tag', async () => {
    let command = '';

    platform.getFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [],
    });
    exec.mockImplementationOnce(cmd => {
      command = cmd;
      return Promise.resolve({
        stdout: '',
        stderr: '',
      });
    });
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    await updateArtifacts('Podfile', ['foo'], '', {
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });
    expect(command).toContain('renovate/cocoapods:latest');
    expect(command).toContain('user=ubuntu');
    expect(exec).toBeCalledTimes(1);
  });
});
