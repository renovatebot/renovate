import { join } from 'upath';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as cargo from '../../../lib/manager/cargo/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';
import { envMock, mockExecAll } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';
import { setExecConfig } from '../../../lib/util/exec';
import { BinarySource } from '../../../lib/util/exec/common';
import { resetPrefetchedImages } from '../../../lib/util/exec/docker';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  dockerUser: 'foobar',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    setExecConfig(config);
    resetPrefetchedImages();
  });
  it('returns null if no Cargo.lock found', async () => {
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
    platform.getFile.mockResolvedValueOnce('Old Cargo.lock');
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
  it('returns updated Cargo.lock with docker', async () => {
    setExecConfig({ ...config, binarySource: BinarySource.Docker });
    platform.getFile.mockResolvedValueOnce('Old Cargo.lock');
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
