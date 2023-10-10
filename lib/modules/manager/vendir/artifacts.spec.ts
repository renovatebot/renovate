import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import * as vendir from '.';

jest.mock('../../datasource', () => mockDeep());
jest.mock('../../../util/exec/env');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};
const vendirLockFile1 = Fixtures.get('vendir_1.lock');
const vendirLockFile2 = Fixtures.get('vendir_2.lock');
const vendirFile = Fixtures.get('vendir.yml');

describe('modules/manager/vendir/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no vendir.lock.yml found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.lock.yml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as any);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated vendir.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      })
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(2);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated vendir.yml for lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps: [],
        newPackageFileContent: vendirFile,
        config: { ...config, updateType: 'lockFileMaintenance' },
      })
    ).toMatchObject([
      {
        file: {
          type: 'addition',
          path: 'vendir.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(2);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      })
    ).toMatchObject([
      {
        artifactError: {
          lockFile: 'vendir.yml',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('add sub chart artifacts to file list if vendir.yml exists', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1 as never);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2 as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
        deleted: ['charts/example-1.6.2.tgz'],
      })
    );
    const updatedDeps = [{ depName: 'dep1' }];
    const test = await vendir.updateArtifacts({
      packageFileName: 'vendir.yml',
      updatedDeps,
      newPackageFileContent: vendirFile,
      config: {
        postUpdateOptions: ['helmUpdateSubChartArchives'],
        ...config,
      },
    });
    expect(test).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.yml',
          contents: vendirLockFile2,
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
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
      },
      {
        cmd: "helm dependency update ''",
      },
    ]);
  });

  it('add sub chart artifacts to file list if vendir.yml is missing', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
        deleted: ['charts/example-1.6.2.tgz'],
      })
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      })
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
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
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
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz'],
      })
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      })
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
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
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
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.9.2.tgz', 'exampleFile'],
        deleted: ['charts/example-1.6.2.tgz', 'aFolder/otherFile'],
      })
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      })
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
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
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
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');

    // sub chart artifacts
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['example/example.tgz'],
      })
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          postUpdateOptions: ['helmUpdateSubChartArchives'],
          ...config,
        },
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm repo add repo-test https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
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
});
