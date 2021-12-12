import { join } from 'upath';
import { envMock, exec, mockExecAll } from '../../../test/exec-util';
import { env, fs, git, mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import * as cargo from './artifacts';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/http');
jest.mock('../../util/fs');


const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
};

describe('manager/cargo/artifacts', () => {
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
    fs.stat.mockRejectedValue(new Error('not found!'));
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
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock' as any);

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
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock' as any);
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

  it('updates Cargo.lock based on the lookupName, when given', async () => {
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock' as any);
    const updatedDeps = [
      {
        depName: 'renamedDep1',
        lookupName: 'dep1',
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
    fsExtra.stat.mockRejectedValueOnce(
      new Error('crates/one/Cargo.lock not found')
    );
    fsExtra.stat.mockRejectedValueOnce(
      new Error('crates/Cargo.lock not found')
    );
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);

    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock' as any);
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
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock' as any);
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
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock' as any);
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
    fsExtra.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock' as any);
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
