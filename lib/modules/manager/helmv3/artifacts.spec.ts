import type { GetAuthorizationTokenCommandOutput } from '@aws-sdk/client-ecr';
import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { mockClient } from 'aws-sdk-client-mock';
import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import { toBase64 } from '../../../util/string';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as helmv3 from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { Fixtures } from '~test/fixtures';
import { env, fs, git, partial } from '~test/util';

vi.mock('../../datasource', () => mockDeep());
vi.mock('../../../util/exec/env');
vi.mock('../../../util/http');
vi.mock('../../../util/fs');

const datasource = vi.mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};
const ociLockFile1 = Fixtures.get('oci_1.lock');
const ociLockFile2 = Fixtures.get('oci_2.lock');
const chartFile = Fixtures.get('Chart.yaml');

const ociLockFile1Alias = Fixtures.get('oci_1_alias.lock');
const ociLockFile2Alias = Fixtures.get('oci_2_alias.lock');
const chartFileAlias = Fixtures.get('ChartAlias.yaml');

const ociLockFile1ECR = Fixtures.get('oci_1_ecr.lock');
const ociLockFile2ECR = Fixtures.get('oci_2_ecr.lock');
const chartFileECR = Fixtures.get('ChartECR.yaml');

const ecrMock = mockClient(ECRClient);

function mockEcrAuthResolve(
  res: Partial<GetAuthorizationTokenCommandOutput> = {},
) {
  ecrMock.on(GetAuthorizationTokenCommand).resolvesOnce(res);
}

function mockEcrAuthReject(msg: string) {
  ecrMock.on(GetAuthorizationTokenCommand).rejectsOnce(new Error(msg));
}

describe('modules/manager/helmv3/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
    ecrMock.reset();
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
      }),
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null if only "generated" is changed', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      dependencies:
      - name: renovate-test
        repository: oci://registry.gitlab.com/user/oci-helm-test
        version: 0.1.0
      digest: sha256:886f204516ea48785fe615d22071d742f7fb0d6519ed3cd274f4ec0978d8b82b
      generated: "2022-01-20T17:48:47.610371241+01:00"
      `);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execMocks = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      dependencies:
      - name: renovate-test
        repository: oci://registry.gitlab.com/user/oci-helm-test
        version: 0.1.0
      digest: sha256:886f204516ea48785fe615d22071d742f7fb0d6519ed3cd274f4ec0978d8b82b
      generated: "2025-01-20T17:48:47.610371241+01:00"
      `);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).toBeNull();
    expect(execMocks).toBeArrayOfSize(2);
    expect(execMocks[0].cmd).toBe(
      'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
    );
    expect(execMocks[1].cmd).toBe("helm dependency update ''");
  });

  it('returns updated Chart.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).toMatchObject([
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
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toMatchObject([
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
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
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
      }),
    ).toMatchObject([
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
      '/tmp/renovate/cache/__renovate-private-cache',
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
      }),
    ).toMatchObject([
      {
        artifactError: {
          lockFile: 'Chart.lock',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('add sub chart artifacts to file list if Chart.lock exists', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
        deleted: ['charts/example-1.6.2.tgz'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    const test = await helmv3.updateArtifacts({
      packageFileName: 'Chart.yaml',
      updatedDeps,
      newPackageFileContent: chartFile,
      config: {
        postUpdateOptions: ['helmUpdateSubChartArchives'],
        ...config,
      },
    });
    expect(test).toEqual([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.9.2.tgz',
          contents: undefined,
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'charts/example-1.6.2.tgz',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });

  it('add sub chart artifacts to file list if Chart.lock is missing', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
        deleted: ['charts/example-1.6.2.tgz'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.9.2.tgz',
          contents: undefined,
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'charts/example-1.6.2.tgz',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
      {
        cmd: "helm dependency update ''",
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
    ]);
  });

  it('add sub chart artifacts without old archives', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.9.2.tgz',
          contents: undefined,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
      {
        cmd: "helm dependency update ''",
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
    ]);
  });

  it('add sub chart artifacts and ignore files outside of the chart folder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz', 'exampleFile'],
        deleted: ['charts/example-1.6.2.tgz', 'aFolder/otherFile'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.9.2.tgz',
          contents: undefined,
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'charts/example-1.6.2.tgz',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
      {
        cmd: "helm dependency update ''",
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
    ]);
  });

  it('skip artifacts which are not lock files or in the chart folder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['example/example.tgz'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
      {
        cmd: "helm dependency update ''",
        options: {
          env: {
            HELM_EXPERIMENTAL_OCI: '1',
            HELM_REGISTRY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/registry.json',
            HELM_REPOSITORY_CONFIG:
              '/tmp/renovate/cache/__renovate-private-cache/repositories.yaml',
            HELM_REPOSITORY_CACHE:
              '/tmp/renovate/cache/__renovate-private-cache/repositories',
          },
        },
      },
    ]);
  });

  it('sets repositories from registryAliases ignoring not well formed URI', async () => {
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
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
          isLockFileMaintenance: true,
          registryAliases: {
            stable: 'http://the_stable_url',
            repo1: 'https://the_repo1_url',
            $REGISTRY_ALIAS: 'my.registry.tld',
          },
        },
      }),
    ).toMatchObject([
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
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1 as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
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
          isLockFileMaintenance: true,
          registryAliases: {
            stable: 'http://the_stable_url',
            repo1: 'https://the_repo1_url',
            $REGISTRY_ALIAS: 'my.registry.tld',
          },
        },
      }),
    ).toMatchObject([
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
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {
            stable: 'http://the_stable_url',
            oci: 'oci://registry.example.com/organization',
            repo1: 'https://the_repo1_url',
          },
        },
      }),
    ).toMatchObject([
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
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).toMatchObject([
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

  it('supports ECR authentication', async () => {
    mockEcrAuthResolve({
      authorizationData: [
        { authorizationToken: toBase64('token-username:token-password') },
      ],
    });

    hostRules.add({
      username: 'some-username',
      password: 'some-password',
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    expect(await ecr.config.region()).toBe('us-east-1');
    expect(await ecr.config.credentials()).toEqual({
      $source: {
        CREDENTIALS_CODE: 'e',
      },
      accessKeyId: 'some-username',
      secretAccessKey: 'some-password',
      sessionToken: 'some-session-token',
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm registry login --username token-username --password token-password 123456789.dkr.ecr.us-east-1.amazonaws.com',
      },
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });

  it("does not use ECR authentication when the host rule's username is AWS", async () => {
    mockEcrAuthResolve({
      authorizationData: [
        { authorizationToken: toBase64('token-username:token-password') },
      ],
    });

    hostRules.add({
      username: 'AWS',
      password: 'some-password',
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    expect(ecrMock.calls).toHaveLength(0);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm registry login --username AWS --password some-password 123456789.dkr.ecr.us-east-1.amazonaws.com',
      },
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });

  it('continues without auth if the ECR token is invalid', async () => {
    mockEcrAuthResolve({
      authorizationData: [{ authorizationToken: ':' }],
    });

    hostRules.add({
      username: 'some-username',
      password: 'some-password',
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    expect(await ecr.config.region()).toBe('us-east-1');
    expect(await ecr.config.credentials()).toEqual({
      $source: {
        CREDENTIALS_CODE: 'e',
      },
      accessKeyId: 'some-username',
      secretAccessKey: 'some-password',
      sessionToken: 'some-session-token',
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });

  it('continues without auth if ECR authentication fails', async () => {
    mockEcrAuthReject('some error');

    hostRules.add({
      username: 'some-username',
      password: 'some-password',
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });

    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    expect(await ecr.config.region()).toBe('us-east-1');
    expect(await ecr.config.credentials()).toEqual({
      $source: {
        CREDENTIALS_CODE: 'e',
      },
      accessKeyId: 'some-username',
      secretAccessKey: 'some-password',
      sessionToken: 'some-session-token',
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: "helm dependency update ''",
      },
    ]);
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
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {
            repo1:
              'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
          },
        },
      }),
    ).toMatchObject([
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
        value.cmd.startsWith('helm repo add repo1'),
      ),
    ).toBeArrayOfSize(1);
    expect(
      execSnapshots.filter((value) =>
        value.cmd.includes(
          'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
        ),
      ),
    ).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('do not add registryAliases to repository list', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1Alias as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2Alias as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileAlias,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {
            jetstack: 'https://charts.jetstack.io',
          },
        },
      }),
    ).toMatchObject([
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
          value.cmd.includes('https://charts.jetstack.io'),
      ),
    ).toBeArrayOfSize(1);
    expect(
      execSnapshots.filter(
        (value) =>
          value.cmd.startsWith('helm repo add nginx') && // falling back to name
          value.cmd.includes('https://kubernetes.github.io/ingress-nginx'),
      ),
    ).toBeArrayOfSize(1);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('prevents injections', async () => {
    const username = 'user';
    const password = 'pass>word';
    mockEcrAuthResolve({
      authorizationData: [
        { authorizationToken: toBase64(username + ':' + password) },
      ],
    });

    hostRules.add({
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const execSnapshots = mockExecAll();
    await helmv3.updateArtifacts({
      packageFileName: 'Chart.yaml',
      updatedDeps: [{}],
      newPackageFileContent: `dependencies: { repository: oci://123456789.dkr.ecr.us-east-1.amazonaws.com/bitnami || date }`,
      config: { ...config },
    });
    expect(execSnapshots).toMatchObject([
      {
        cmd: `helm registry login --username ${username} --password '${password}' '123456789.dkr.ecr.us-east-1.amazonaws.com/bitnami || date'`,
      },
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });
});
