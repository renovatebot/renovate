import { join } from 'upath';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import { platform as _platform } from '../../../lib/platform';
import { updateArtifacts } from '../../../lib/manager/cocoapods';
import * as _datasource from '../../../lib/datasource/docker';
import { mocked } from '../../util';
import { envMock, mockExecAll } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';
import { setExecConfig } from '../../../lib/util/exec';
import { BinarySource } from '../../../lib/util/exec/common';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');
jest.mock('../../../lib/platform');
jest.mock('../../../lib/datasource/docker');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);
const datasource = mocked(_datasource);

const config = {
  localDir: join('/tmp/github/some/repo'),
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    setExecConfig(config);

    datasource.getPkgReleases.mockResolvedValue({
      releases: [
        { version: '1.2.0' },
        { version: '1.2.1' },
        { version: '1.2.2' },
        { version: '1.2.3' },
        { version: '1.2.4' },
        { version: '1.2.5' },
      ],
    });
  });
  it('returns null if no Podfile.lock found', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if no updatedDeps were provided', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null for invalid local directory', async () => {
    const execSnapshots = mockExecAll(exec);
    const noLocalDirConfig = {
      localDir: undefined,
    };
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config: noLocalDirConfig,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if updatedDeps is empty', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll(exec);
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    fs.readFile.mockResolvedValueOnce('Current Podfile' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Podfile', async () => {
    const execSnapshots = mockExecAll(exec);
    setExecConfig({ ...config, binarySource: BinarySource.Docker });
    platform.getFile.mockResolvedValueOnce('Old Podfile');
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches write error', async () => {
    const execSnapshots = mockExecAll(exec);
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches read error', async () => {
    const execSnapshots = mockExecAll(exec);
    platform.getFile.mockResolvedValueOnce('Current Podfile');
    fs.outputFile.mockResolvedValueOnce(null as never);
    fs.readFile.mockImplementationOnce(() => {
      throw new Error('read error');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns pod exec error', async () => {
    const execSnapshots = mockExecAll(exec, new Error('exec exception'));
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    fs.readFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns pod exec stderr', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '',
      stderr: 'Something happened',
    });
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('does not return stderr if lockfile has changed', async () => {
    const execSnapshots = mockExecAll(exec, {
      stdout: '',
      stderr: 'Just a warning',
    });
    platform.getFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputFile.mockImplementationOnce(() => {});
    fs.readFile.mockResolvedValueOnce('New Podfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('dynamically selects Docker image tag', async () => {
    const execSnapshots = mockExecAll(exec);

    setExecConfig({
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });

    platform.getFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');

    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: ['foo'],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot();
  });
  it('falls back to the `latest` Docker image tag', async () => {
    const execSnapshots = mockExecAll(exec);

    setExecConfig({
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });

    platform.getFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [],
    });

    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: ['foo'],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot();
  });
});
