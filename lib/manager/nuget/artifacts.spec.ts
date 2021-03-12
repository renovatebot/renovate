import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { fs, mocked } from '../../../test/util';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as _hostRules from '../../util/host-rules';
import * as nuget from './artifacts';
import {
  getConfiguredRegistries as _getConfiguredRegistries,
  getDefaultRegistries as _getDefaultRegistries,
  getRandomString as _getRandomString,
} from './util';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/fs');
jest.mock('../../util/host-rules');
jest.mock('./util');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const getConfiguredRegistries: jest.Mock<
  typeof _getConfiguredRegistries
> = _getConfiguredRegistries as any;
const getDefaultRegistries: jest.Mock<
  typeof _getDefaultRegistries
> = _getDefaultRegistries as any;
const getRandomString: jest.Mock<
  typeof _getRandomString
> = _getRandomString as any;
const hostRules = mocked(_hostRules);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};

describe('updateArtifacts', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    getDefaultRegistries.mockReturnValue([] as any);
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    fs.ensureCacheDir.mockImplementation((dirName: string) =>
      Promise.resolve(dirName)
    );
    getRandomString.mockReturnValue('not-so-random' as any);
    await setUtilConfig(config);
    docker.resetPrefetchedImages();
  });
  it('aborts if no lock file found', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('aborts if lock file is unchanged', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('updates lock file', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('does not update lock file when non-proj file is changed', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'otherfile.props',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('does not update lock file when no deps changed', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
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
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config: {
          ...config,
          binarySource: BinarySource.Global,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
  it('authenticates at registries', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
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
      return undefined;
    });
    expect(
      await nuget.updateArtifacts({
        packageFileName: 'project.csproj',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('strips protocol version from feed url', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName.mockReturnValueOnce('packages.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('Current packages.lock.json' as any);
    fs.readLocalFile.mockResolvedValueOnce('New packages.lock.json' as any);
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
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
