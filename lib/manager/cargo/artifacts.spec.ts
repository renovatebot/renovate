import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as cargo from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
};

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(config);
    docker.resetPrefetchedImages();
  });
  it('returns null if no Cargo.lock found', async () => {
    fs.stat.mockRejectedValue(new Error('not found!'));
    const updatedDeps = ['dep1'];
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
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.readFile.mockResolvedValueOnce('Current Cargo.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current Cargo.lock' as any);

    const updatedDeps = ['dep1'];
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
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Cargo.lock' as any);
    const updatedDeps = ['dep1'];
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
    fs.stat.mockRejectedValueOnce(new Error('crates/one/Cargo.lock not found'));
    fs.stat.mockRejectedValueOnce(new Error('crates/Cargo.lock not found'));
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);

    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Cargo.lock' as any);
    const updatedDeps = ['dep1'];
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
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Cargo.lock' as any);
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
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setExecConfig({ ...config, binarySource: BinarySource.Docker });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Cargo.lock' as any);
    const updatedDeps = ['dep1'];
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
    fs.stat.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.readFile.mockResolvedValueOnce('Current Cargo.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
});
