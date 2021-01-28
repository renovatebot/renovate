import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as terraform from './artifacts';

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
  dockerUser: 'foobar',
};

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(config);
    docker.resetPrefetchedImages();
  });
  it('returns null if no .terraform.lock.hcl found', async () => {
    const updatedDeps = ['dep1'];
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'versions.tf',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'versions.tf',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('Current .terraform.lock.hcl' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current .terraform.lock.hcl' as any);
    const updatedDeps = ['dep1'];
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'versions.tf',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated .terraform.lock.hcl', async () => {
    git.getFile.mockResolvedValueOnce('Old .terraform.lock.hcl');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New .terraform.lock.hcl' as any);
    const updatedDeps = ['dep1'];
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'versions.tf',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated .terraform.lock.hcl for lockfile maintenance', async () => {
    git.getFile.mockResolvedValueOnce('Old .terraform.lock.hcl');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New .terraform.lock.hcl' as any);
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'versions.tf',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated .terraform.lock.hcl with docker', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setExecConfig({ ...config, binarySource: BinarySource.Docker });
    git.getFile.mockResolvedValueOnce('Old .terraform.lock.hcl');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New .terraform.lock.hcl' as any);
    const updatedDeps = ['dep1'];
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'provider.tf',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current .terraform.lock.hcl' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await terraform.updateArtifacts({
        packageFileName: 'provider.tf',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
});
