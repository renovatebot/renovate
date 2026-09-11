import type { GetAuthorizationTokenCommandOutput } from '@aws-sdk/client-ecr';
import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { mockClient } from 'aws-sdk-client-mock';
import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { toBase64 } from '../../../util/string.ts';
import * as _datasource from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import * as helmv3 from './index.ts';

vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/http/index.ts');
vi.mock('../../../util/fs/index.ts');

const datasource = vi.mocked(_datasource);

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  binarySource: 'global',
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).resolves.toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).resolves.toBeNull();
    expect(execMocks).toBeArrayOfSize(2);
    expect(execMocks[0].cmd).toBe(
      'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
    );
    expect(execMocks[1].cmd).toBe("helm dependency update ''");
  });

  it('returns updated Chart.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
  });

  it('returns updated Chart.lock for lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
  });

  it('returns updated Chart.lock with docker', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v3.7.2' }],
    });
    const updatedDeps = [{ depName: 'dep1' }];
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd: 'docker run --rm --name=renovate_sidecar --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e CI -e HELM_EXPERIMENTAL_OCI -e HELM_REGISTRY_CONFIG -e HELM_REPOSITORY_CONFIG -e HELM_REPOSITORY_CACHE -e CONTAINERBASE_CACHE_DIR -w "/tmp/github/some/repo" ghcr.io/renovatebot/base-image bash -l -c \'install-tool helm v3.7.2 && helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update && helm dependency update \'"\'\'"',
      },
    ]);
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config,
      }),
    ).resolves.toMatchObject([
      {
        artifactError: {
          fileName: 'Chart.lock',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('add sub chart artifacts to file list if Chart.lock exists', async () => {
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).resolves.toEqual([
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).resolves.toEqual([
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).resolves.toEqual([
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
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps,
        newPackageFileContent: chartFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      }),
    ).resolves.toBeNull();
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
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
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'helm repo add stable http://the_stable_url --force-update' },
      { cmd: 'helm repo add repo1 https://the_repo1_url --force-update' },
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
  });

  it('sets repositories from registryAliases with docker', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v3.7.2' }],
    });
    await expect(
      helmv3.updateArtifacts({
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
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd: 'docker run --rm --name=renovate_sidecar --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e CI -e HELM_EXPERIMENTAL_OCI -e HELM_REGISTRY_CONFIG -e HELM_REPOSITORY_CONFIG -e HELM_REPOSITORY_CACHE -e CONTAINERBASE_CACHE_DIR -w "/tmp/github/some/repo" ghcr.io/renovatebot/base-image bash -l -c \'install-tool helm v3.7.2 && helm repo add stable http://the_stable_url --force-update && helm repo add repo1 https://the_repo1_url --force-update && helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update && helm dependency update \'"\'\'"',
      },
    ]);
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
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
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm registry login --username test --password aPassword registry.example.com',
      },
      { cmd: 'helm repo add stable http://the_stable_url --force-update' },
      {
        cmd: 'helm repo add repo1 https://the_repo1_url --force-update --username basicUser --password secret',
      },
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFile,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm registry login --username registryUser --password password registry.gitlab.com',
      },
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update --username basicUser --password secret',
      },
      { cmd: "helm dependency update ''" },
    ]);
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    await expect(ecr.config.region()).resolves.toBe('us-east-1');
    await expect(ecr.config.credentials()).resolves.toEqual({
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).resolves.toMatchObject([
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    await expect(ecr.config.region()).resolves.toBe('us-east-1');
    await expect(ecr.config.credentials()).resolves.toEqual({
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2ECR);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    await expect(
      helmv3.updateArtifacts({
        packageFileName: 'Chart.yaml',
        updatedDeps: [],
        newPackageFileContent: chartFileECR,
        config: {
          ...config,
          isLockFileMaintenance: true,
          registryAliases: {},
        },
      }),
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2ECR,
        },
      },
    ]);

    const ecr = ecrMock.call(0).thisValue as ECRClient;
    await expect(ecr.config.region()).resolves.toBe('us-east-1');
    await expect(ecr.config.credentials()).resolves.toEqual({
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
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
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
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo1 https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable --force-update --username basicUser --password secret',
      },
      { cmd: "helm dependency update ''" },
    ]);
  });

  it('do not add registryAliases to repository list', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1Alias);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile2Alias);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    await expect(
      helmv3.updateArtifacts({
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
    ).resolves.toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'Chart.lock',
          contents: ociLockFile2Alias,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add jetstack https://charts.jetstack.io --force-update',
      },
      {
        cmd: 'helm repo add nginx https://kubernetes.github.io/ingress-nginx --force-update',
      },
      { cmd: "helm dependency update ''" },
    ]);
  });

  it('prevents injections', async () => {
    const username = 'user';
    const password = 'pass>word';
    mockEcrAuthResolve({
      authorizationData: [
        { authorizationToken: toBase64(`${username}:${password}`) },
      ],
    });

    hostRules.add({
      token: 'some-session-token',
      hostType: 'docker',
      matchHost: '123456789.dkr.ecr.us-east-1.amazonaws.com',
    });
    fs.getSiblingFileName.mockReturnValueOnce('Chart.lock');
    fs.readLocalFile.mockResolvedValueOnce(ociLockFile1ECR);
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
