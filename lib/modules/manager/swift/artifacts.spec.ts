import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import * as swift from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');

const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

describe('modules/manager/swift/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no Package.resolved file found', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(false);
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('Current Package.resolved');
    fs.getParentDir.mockReturnValueOnce('');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current Package.resolved');

    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Package.resolved', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    git.getFile.mockResolvedValueOnce('Old Package.resolved');
    fs.getParentDir.mockReturnValueOnce('');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New Package.resolved');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('handles package in subfolder', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('sub/path/Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    git.getFile.mockResolvedValueOnce('Old Package.resolved');
    fs.getParentDir.mockReturnValueOnce('sub/path/');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New Package.resolved');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'sub/path/Package.swift',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Package.resolved for lockfile maintenance', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    git.getFile.mockResolvedValueOnce('Old Package.resolved');
    fs.getParentDir.mockReturnValueOnce('');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New Package.resolved');
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Package.resolved with docker', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    git.getFile.mockResolvedValueOnce('Old Package.resolved');
    fs.getParentDir.mockReturnValueOnce('');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New Package.resolved');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Package.resolved');
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('Current Package.resolved');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await swift.updateArtifacts({
        packageFileName: 'Package.swift',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Package.resolved', stderr: 'not found' } },
    ]);
  });
});
