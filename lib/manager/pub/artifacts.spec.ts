import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { UpdateArtifactsConfig } from '../types';
import * as pub from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const adminConfig: RepoAdminConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
};

const config: UpdateArtifactsConfig = {};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    setAdminConfig(adminConfig);
    docker.resetPrefetchedImages();
  });
  afterEach(() => {
    setAdminConfig();
  });
  it('returns null if no pubspec.lock found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('Current pubspec.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated dart pubspec.lock', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated dart pubspec.lock for lockfile maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated dart pubspec.lock with docker', async () => {
    setAdminConfig({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated flutter pubspec.lock', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: 'sdk: flutter',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated flutter pubspec.lock for lockfile maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps: [],
        newPackageFileContent: 'sdk: flutter',
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated flutter pubspec.lock with docker', async () => {
    setAdminConfig({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Old pubspec.lock' as any);
    fs.readFile.mockResolvedValueOnce('New pubspec.lock' as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: 'sdk: flutter',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current pubspec.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await pub.updateArtifacts({
        packageFileName: 'pubspec.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot();
  });
});
