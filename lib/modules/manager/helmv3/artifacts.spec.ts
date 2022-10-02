import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as helmv3 from '.';

jest.mock('../../datasource');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');

const datasource = mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};
const ociLockFile1 = Fixtures.get('oci_1.lock');
const ociLockFile2 = Fixtures.get('oci_2.lock');
const chartFile = Fixtures.get('Chart.yaml');

const ociLockFile1Alias = Fixtures.get('oci_1_alias.lock');
const ociLockFile2Alias = Fixtures.get('oci_2_alias.lock');
const chartFileAlias = Fixtures.get('ChartAlias.yaml');

describe('modules/manager/helmv3/artifacts', () => {
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
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
    expect(execSnapshots).toBeArrayOfSize(2);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock for lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
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
    expect(execSnapshots).toBeArrayOfSize(2);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Chart.lock with docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v3.7.2' }],
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
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
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

  it('sets repositories from registryAliases', async () => {
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
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

  it('sets repositories from registryAliases with docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v3.7.2' }],
    });
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: { stable: 'the_stable_url', repo1: 'the_repo1_url' },
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

  it('log into private registries and repositories already defined in registryAliases', async () => {
    hostRules.add({
      username: 'test',
      password: 'aPassword',
      hostType: 'docker',
      matchHost: 'registry.example.com',
    });
    hostRules.add({
      username: 'basicUser',
      password: 'secret',
      hostType: 'helm',
      matchHost: 'the_repo1_url',
    });

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: {
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
    expect(execSnapshots).toBeArrayOfSize(5);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('log into private registries and repositories NOT defined in registryAliases', async () => {
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

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: {},
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

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: {
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
    expect(
      execSnapshots.filter((value) =>
        value.cmd.includes(
          'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable'
        )
      )
    ).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('do not add registryAliases to repository list', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1Alias as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2Alias as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileAlias,
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
          registryAliases: {
            jetstack: 'https://charts.jetstack.io',
          },
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2Alias,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(
      execSnapshots.filter(
        (value) =>
          value.cmd.startsWith('helm repo add jetstack') && // alias
          value.cmd.includes('https://charts.jetstack.io')
      )
    ).toBeArrayOfSize(1);
    expect(
      execSnapshots.filter(
        (value) =>
          value.cmd.startsWith('helm repo add nginx') && // falling back to name
          value.cmd.includes('https://kubernetes.github.io/ingress-nginx')
      )
    ).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });
});
