import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import type { StatusResult } from '../../../util/git/types';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { UpdateArtifactsConfig } from '../types';
import * as kustomize from '.';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');
vi.mock('../../datasource', () => mockDeep());

const getPkgReleases = vi.mocked(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {
  postUpdateOptions: ['kustomizeInflateHelmCharts'],
};

const packageFileName = 'kustomization.yaml';
const newPackageFileContent = 'kind: Kustomization';

describe('modules/manager/kustomize/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
  });

  it('returns null if newPackageFileContent is not parseable', async () => {
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent: 'unparseable',
        config,
      }),
    ).toEqual([
      { artifactError: { stderr: 'Failed to parse new package file content' } },
    ]);
  });

  it('returns null if no HelmChart dependencies found', async () => {
    const updatedDeps = [
      {
        depType: 'Kustomization',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no dependency name is found', async () => {
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depname: undefined,
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no registryUrl is found', async () => {
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: [],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no packageName is found', async () => {
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        packageName: undefined,
        datasource: DockerDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if neither currentVersion or newVersion is found', async () => {
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: undefined,
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if newVersion is not found and currentVersion is already inflated', async () => {
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.localPathExists.mockResolvedValueOnce(true);
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
  });

  it('returns null if old version is not inflated and kustomizeInflateHelmCharts is not enabled', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: [],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config: {
          ...config,
          postUpdateOptions: [],
        },
      }),
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('returns null if newVersion and currentVersion is the same', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: [],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '1.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];
    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('inflates new version if old version is inflated and kustomizeInflateHelmCharts is not enabled', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(true);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: [
          'charts/example-2.0.0/example/Chart.yaml',
          'outside_of_charts/example-2.0.0/example/Chart.yaml',
        ],
        deleted: [
          'charts/example-1.0.0/example/Chart.yaml',
          'outside_of_charts/example-1.0.0/example/Chart.yaml',
        ],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config: {
          ...config,
          postUpdateOptions: [],
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-2.0.0/example/Chart.yaml',
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'charts/example-1.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).toHaveBeenCalledWith('charts/example-1.0.0');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm pull --untar --untardir charts/example-2.0.0 --version 2.0.0 --repo https://github.com.com/example/example example',
      },
    ]);
  });

  it('inflates new version if old version is not inflated but kustomizeInflateHelmCharts is enabled', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-2.0.0/example/Chart.yaml'],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: '2.0.0',
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-2.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm pull --untar --untardir charts/example-2.0.0 --version 2.0.0 --repo https://github.com.com/example/example example',
      },
    ]);
  });

  it('inflates current version if no new version and kustomizeInflateHelmCharts is enabled', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.0.0/example/Chart.yaml'],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm pull --untar --untardir charts/example-1.0.0 --version 1.0.0 --repo https://github.com.com/example/example example',
      },
    ]);
  });

  it('handles OCI repositories', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.0.0/example/Chart.yaml'],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        packageName: 'github.com/example/example/example',
        datasource: DockerDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm pull --untar --untardir charts/example-1.0.0 --version 1.0.0 oci://github.com/example/example/example',
      },
    ]);
  });

  it('installs binaries on install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.0.0/example/Chart.yaml'],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        packageName: 'github.com/example/example/example',
        datasource: DockerDatasource.id,
      },
    ];

    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.0' }, { version: '3.17.0' }],
    });

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool helm 3.17.0' },
      {
        cmd: 'helm pull --untar --untardir charts/example-1.0.0 --version 1.0.0 oci://github.com/example/example/example',
      },
    ]);
  });

  it('installs binaries on docker mode', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['charts/example-1.0.0/example/Chart.yaml'],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        packageName: 'github.com/example/example/example',
        datasource: DockerDatasource.id,
      },
    ];

    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.0' }, { version: '3.17.0' }],
    });

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'charts/example-1.0.0/example/Chart.yaml',
        },
      },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e HELM_REGISTRY_CONFIG ' +
          '-e HELM_REPOSITORY_CONFIG ' +
          '-e HELM_REPOSITORY_CACHE ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool helm 3.17.0' +
          ' && ' +
          'helm pull --untar --untardir charts/example-1.0.0 --version 1.0.0 oci://github.com/example/example/example' +
          '"',
      },
    ]);
  });

  it('does not inflate current version if kustomizeInflateHelmCharts is not enabled', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockResolvedValueOnce(false);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: [],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config: {
          ...config,
          postUpdateOptions: [],
        },
      }),
    ).toBeNull();
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: [],
        deleted: [],
      }),
    );
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config: {
          ...config,
          postUpdateOptions: [],
        },
      }),
    ).toEqual([{ artifactError: { stderr: 'not found' } }]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('throws on TEMPORARY_ERROR', async () => {
    const execSnapshots = mockExecAll();

    fs.localPathExists.mockImplementationOnce(() => {
      throw new Error(TEMPORARY_ERROR);
    });
    const updatedDeps = [
      {
        depType: 'HelmChart',
        depName: 'example',
        newVersion: undefined,
        currentVersion: '1.0.0',
        registryUrls: ['https://github.com.com/example/example'],
        datasource: HelmDatasource.id,
      },
    ];

    await expect(() =>
      kustomize.updateArtifacts({
        packageFileName,
        updatedDeps,
        newPackageFileContent,
        config: {
          ...config,
          postUpdateOptions: [],
        },
      }),
    ).rejects.toThrowError(TEMPORARY_ERROR);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('prevents injections', async () => {
    const execSnapshots = mockExecAll();
    fs.localPathExists.mockResolvedValueOnce(false);

    expect(
      await kustomize.updateArtifacts({
        packageFileName,
        updatedDeps: [
          {
            depType: 'HelmChart',
            depName: 'example && ls -lart; ',
            currentVersion: '1.0.0',
            registryUrls: ['https://github.com.com/example/example'],
            datasource: HelmDatasource.id,
          },
        ],
        newPackageFileContent,
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: "helm pull --untar --untardir 'charts/example && ls -lart; -1.0.0' --version 1.0.0 --repo https://github.com.com/example/example 'example && ls -lart; '",
      },
    ]);
  });
});
