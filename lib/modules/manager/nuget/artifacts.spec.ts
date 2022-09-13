import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _hostRules from '../../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import * as util from './util';
import * as nuget from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/git');
jest.mock('./util');

const { getConfiguredRegistries, getDefaultRegistries } = mocked(util);
const hostRules = mocked(_hostRules);

const realFs = jest.requireActual(
  '../../../util/fs'
) as typeof import('../../../util/fs');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/nuget/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    getDefaultRegistries.mockReturnValue([]);
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    fs.privateCacheDir.mockImplementation(realFs.privateCacheDir);
    git.getFileList.mockResolvedValueOnce([]);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('aborts if no lock file found', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('aborts if lock file is unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce(
      'path/with space/packages.lock.json'
    );
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'path/with space/project.csproj',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('updates lock file', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('does not update lock file when non-proj file is changed', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'otherfile.props',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('does not update lock file when no deps changed', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        artifactError: {
          lockFile: 'packages.lock.json',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('authenticates at registries', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    getConfiguredRegistries.mockResolvedValueOnce([
      {
        name: 'myRegistry',
        url: 'https://my-registry.example.org',
      },
    ] as never);
    hostRules.find.mockImplementationOnce((search) => {
      if (
        search.hostType === 'nuget' &&
        search.url === 'https://my-registry.example.org'
      ) {
        return {
          username: 'some-username',
          password: 'some-password',
        };
      }
      return {};
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('strips protocol version from feed url', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    git.getFile.mockResolvedValueOnce('Current packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json');
    getConfiguredRegistries.mockResolvedValueOnce([
      {
        name: 'myRegistry',
        url: 'https://my-registry.example.org#protocolVersion=3',
      },
    ] as never);
    hostRules.find.mockImplementationOnce(() => ({}));
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [{ depName: 'dep' }],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
