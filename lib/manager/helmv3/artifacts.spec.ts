import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { UpdateArtifactsConfig } from '../types';
import * as helmv3 from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
};

const config: UpdateArtifactsConfig = {};

describe('manager/helmv3/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    setGlobalConfig(adminConfig);
    docker.resetPrefetchedImages();
  });
  afterEach(() => {
    setGlobalConfig();
  });
  it('returns null if no Chart.lock found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('Current Chart.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current Chart.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Chart.lock', async () => {
    fs.readFile.mockResolvedValueOnce('Old Chart.lock' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Chart.lock' as never);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot([
      { file: { contents: 'New Chart.lock', name: 'Chart.lock' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock for lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Old Chart.lock' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Chart.lock' as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).toMatchSnapshot([
      { file: { contents: 'New Chart.lock', name: 'Chart.lock' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock with docker', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce('Old Chart.lock' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Chart.lock' as never);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot([
      { file: { contents: 'New Chart.lock', name: 'Chart.lock' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current Chart.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot([
      {
        artifactError: {
          lockFile: 'Chart.lock',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('sets repositories from aliases', async () => {
    fs.readFile.mockResolvedValueOnce('Old Chart.lock' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Chart.lock' as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
        },
      })
    ).toMatchSnapshot([
      { file: { contents: 'New Chart.lock', name: 'Chart.lock' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('sets repositories from aliases with docker', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce('Old Chart.lock' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New Chart.lock' as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
        },
      })
    ).toMatchSnapshot([
      { file: { contents: 'New Chart.lock', name: 'Chart.lock' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
});
