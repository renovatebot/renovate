import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { loadFixture, mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as hostRules from '../../util/host-rules';
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
  cacheDir: join('/tmp/renovate/cache'),
};

const config: UpdateArtifactsConfig = {};
const ociLockFile1 = loadFixture('oci_1.lock');
const ociLockFile2 = loadFixture('oci_2.lock');
const chartFile = loadFixture('Chart.yaml');

describe('manager/helmv3/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
  });
  afterEach(() => {
    GlobalConfig.reset();
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
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as any);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Chart.lock', async () => {
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock for lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock with docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
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
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('sets repositories from aliases with docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('log into private registries and repositories already defined in aliases', async () => {
    hostRules.add({
      username: 'test',
      password: 'aPassword',
      hostType: 'docker',
      matchHost: 'registry.example.com',
    });
    hostRules.add({
      username: 'basicUser',
      password: 'secret',
      matchHost: 'the_repo1_url',
    });

    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: {
            stable: 'the_stable_url',
            oci: 'oci://registry.example.com/organization',
            repo1: 'https://the_repo1_url',
          },
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(4);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('log into private registries and repositories NOT defined in aliases', async () => {
    hostRules.add({
      username: 'registryUser',
      password: 'password',
      hostType: 'docker',
      matchHost: 'registry.gitlab.com',
    });
    hostRules.add({
      username: 'basicUser',
      password: 'secret',
      matchHost:
        'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
    });

    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: {},
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('alias name is picked, when repository is as alias and dependency defined', async () => {
    hostRules.add({
      username: 'basicUser',
      password: 'secret',
      matchHost:
        'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
    });

    fs.readFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce(ociLockFile2 as never);
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          aliases: {
            repo1:
              'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
          },
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(2);
    expect(
      execSnapshots.filter((value) =>
        value.cmd.startsWith('helm repo add repo1')
      )
    ).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });
});
