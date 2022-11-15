import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import * as cargo from '.';

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

describe('modules/manager/cargo/artifacts', () => {
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

  it('returns null if no Cargo.lock found', async () => {
    fs.statLocalFile.mockRejectedValue(new Error('not found!'));
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');

    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('updates Cargo.lock based on the packageName, when given', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'renamedDep1',
        packageName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated workspace Cargo.lock', async () => {
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/one/Cargo.lock not found')
    );
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/Cargo.lock not found')
    );
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);

    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'crates/one/Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock for lockfile maintenance', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock with docker', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Cargo.lock', stderr: 'not found' } },
    ]);
  });
});
