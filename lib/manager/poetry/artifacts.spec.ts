import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { loadFixture, mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import * as _datasource from '../../datasource';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as _hostRules from '../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

const pyproject10toml = loadFixture('pyproject.10.toml');

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../datasource');
jest.mock('../../util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const datasource = mocked(_datasource);
const hostRules = mocked(_hostRules);

const adminConfig: RepoAdminConfig = {
  localDir: join('/tmp/github/some/repo'),
};

const config: UpdateArtifactsConfig = {};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    setAdminConfig(adminConfig);
    docker.resetPrefetchedImages();
  });
  it('returns null if no poetry.lock found', async () => {
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockReturnValueOnce('Current poetry.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock', async () => {
    fs.readFile.mockResolvedValueOnce('[metadata]\n' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('passes private credential environment vars', async () => {
    fs.readFile.mockResolvedValueOnce(null);
    fs.readFile.mockResolvedValueOnce('[metadata]\n' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    hostRules.find.mockReturnValueOnce({
      username: 'usernameOne',
      password: 'passwordOne',
    });
    hostRules.find.mockReturnValueOnce({ username: 'usernameTwo' });
    hostRules.find.mockReturnValueOnce({ password: 'passwordFour' });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: pyproject10toml,
        config,
      })
    ).not.toBeNull();
    expect(hostRules.find.mock.calls).toHaveLength(3);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated pyproject.lock', async () => {
    fs.readFile.mockResolvedValueOnce(null);
    fs.readFile.mockResolvedValueOnce('[metadata]\n' as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock using docker', async () => {
    setAdminConfig({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce('[metadata]\n' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.5' }, { version: '3.4.2' }],
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: {
            python: '~2.7 || ^3.4',
            poetry: 'poetry>=1.1.2 setuptools poetry-dynamic-versioning>1',
          },
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock using docker (constraints)', async () => {
    setAdminConfig({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce(
      '[metadata]\npython-versions = "~2.7 || ^3.4"' as any
    );
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: { poetry: 'poetry>=1.0' },
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current poetry.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
  it('returns updated poetry.lock when doing lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Old poetry.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
