import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { UpdateArtifactsConfig } from '../types';
import * as kustomize from '.';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');
vi.mock('../../../util/git');

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {
  postUpdateOptions: ['kustomizeInflateHelmCharts'],
};

const packageFileName = 'kustomization.yaml';
const newPackageFileContent = 'kind: Kustomization';

describe('modules/manager/kustomize/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
    fs.getSiblingFileName.mockReturnValueOnce('charts');
    fs.deleteLocalFile.mockResolvedValueOnce(undefined);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
  });

  afterEach(() => {
    GlobalConfig.reset();
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
          contents: null,
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
          contents: null,
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
          contents: null,
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
          contents: null,
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

  it('does not inflate current version if kustomizeInflateHelmCharts is not enabled', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
    fs.readLocalFile.mockResolvedValueOnce(null);
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
});
