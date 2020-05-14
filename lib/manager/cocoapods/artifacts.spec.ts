import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import Git from 'simple-git/promise';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/execUtil';
import { mocked } from '../../../test/util';
import * as _datasource from '../../datasource/docker';
import { platform as _platform } from '../../platform';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import * as _env from '../../util/exec/env';
import { updateArtifacts } from '.';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../platform');
jest.mock('../../datasource/docker');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);
const datasource = mocked(_datasource);

const config = {
  localDir: join('/tmp/github/some/repo'),
};

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(config);

    datasource.getReleases.mockResolvedValue({
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
    fs.readFile.mockResolvedValueOnce('Current Podfile' as any);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as Git.StatusResult);
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
    await setExecConfig({ ...config, binarySource: BinarySource.Docker });
    fs.readFile.mockResolvedValueOnce('Old Podfile' as any);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: ['foo'],
        newPackageFileContent: 'plugin "cocoapods-acknowledgements"',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Podfile and Pods files', async () => {
    const execSnapshots = mockExecAll(exec);
    await setExecConfig({ ...config, binarySource: BinarySource.Docker });
    fs.readFile.mockResolvedValueOnce('Old Manifest.lock' as any);
    fs.readFile.mockResolvedValueOnce('New Podfile' as any);
    fs.readFile.mockResolvedValueOnce('Pods manifest' as any);
    platform.getRepoStatus.mockResolvedValueOnce({
      not_added: ['Pods/New'],
      modified: ['Podfile.lock', 'Pods/Manifest.lock'],
      deleted: ['Pods/Deleted'],
    } as Git.StatusResult);
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
    fs.readFile.mockResolvedValueOnce('Current Podfile' as any);
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
  it('returns pod exec error', async () => {
    const execSnapshots = mockExecAll(exec, new Error('exec exception'));
    fs.readFile.mockResolvedValueOnce('Old Podfile.lock' as any);
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
  it('dynamically selects Docker image tag', async () => {
    const execSnapshots = mockExecAll(exec);

    await setExecConfig({
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });

    fs.readFile.mockResolvedValueOnce('COCOAPODS: 1.2.4' as any);

    fs.readFile.mockResolvedValueOnce('New Podfile' as any);

    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as Git.StatusResult);

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

    await setExecConfig({
      ...config,
      binarySource: 'docker',
      dockerUser: 'ubuntu',
    });

    fs.readFile.mockResolvedValueOnce('COCOAPODS: 1.2.4' as any);
    datasource.getReleases.mockResolvedValueOnce({
      releases: [],
    });

    fs.readFile.mockResolvedValueOnce('New Podfile' as any);

    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as Git.StatusResult);

    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: ['foo'],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot();
  });
});
