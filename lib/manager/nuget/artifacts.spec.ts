import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/execUtil';
import { fs, mocked } from '../../../test/util';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as nuget from './artifacts';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/fs');
jest.mock('../../util/git');
jest.mock('../../util/host-rules');

// const hostRules = require('../../util/host-rules');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  dockerUser: 'foobar',
};

describe('updateArtifacts', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
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
        packageFileName: 'composer.json',
        updatedDeps: ['dep'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });

  // _it('uses hostRules to write auth.json', async () => {
  //   fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
  //   const execSnapshots = mockExecAll(exec);
  //   fs.readLocalFile.mockReturnValueOnce('Current composer.lock' as any);
  //   const authConfig = {
  //     ...config,
  //     registryUrls: ['https://packagist.renovatebot.com'],
  //   };
  //   hostRules.find.mockReturnValue({
  //     username: 'some-username',
  //     password: 'some-password',
  //   });
  //   git.getRepoStatus.mockResolvedValue({ modified: [] } as StatusResult);
  //   expect(
  //     await composer.updateArtifacts({
  //       packageFileName: 'composer.json',
  //       updatedDeps: [],
  //       newPackageFileContent: '{}',
  //       config: authConfig,
  //     })
  //   ).toBeNull();
  //   expect(execSnapshots).toMatchSnapshot();
  // });
});
