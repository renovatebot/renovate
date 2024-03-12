import { codeBlock } from 'common-tags';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as helmfile from '.';

jest.mock('../../datasource', () => mockDeep());
jest.mock('../../../util/exec/env');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const datasource = mocked(_datasource);

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};

const helmfileYaml = codeBlock`
repositories:
  - name: backstage
    url: https://backstage.github.io/charts
  - name: oauth2-proxy
    url: https://oauth2-proxy.github.io/manifests
releases:
  - name: backstage
    chart: backstage/backstage
    version: 0.12.0
  - name: oauth-proxy
    chart: oauth2-proxy/oauth2-proxy
    version: 6.8.0
`;

const lockFile = codeBlock`
version: 0.151.0
dependencies:
- name: backstage
  repository: https://backstage.github.io/charts
  version: 0.11.0
- name: oauth2-proxy
  repository: https://oauth2-proxy.github.io/manifests
  version: 6.2.1
digest: sha256:e284706b71f37b757a536703da4cb148d67901afbf1ab431f7d60a9852ca6eef
generated: "2023-03-08T21:32:06.122276997+01:00"
`;
const lockFileTwo = codeBlock`
version: 0.151.0
dependencies:
- name: backstage
  repository: https://backstage.github.io/charts
  version: 0.12.0
- name: oauth2-proxy
  repository: https://oauth2-proxy.github.io/manifests
  version: 6.8.0
digest: sha256:9d83889176d005effb86041d30c20361625561cbfb439cbd16d7243225bac17c
generated: "2023-03-08T21:30:48.273709455+01:00"
`;

describe('modules/manager/helmfile/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
  });

  it('returns null if no helmfile.lock found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    git.getFile.mockResolvedValueOnce(lockFile as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFile as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps: [{ depName: 'dep1' }],
        newPackageFileContent: helmfileYaml,
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'helmfile deps -f helmfile.yaml' },
    ]);
  });

  it('returns updated helmfile.lock', async () => {
    git.getFile.mockResolvedValueOnce(lockFile as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFileTwo as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYaml,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'helmfile.lock',
          contents: lockFileTwo,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'helmfile deps -f helmfile.yaml' },
    ]);
  });

  it('returns updated helmfile.lock if repositories were defined in ../helmfile-defaults.yaml.', async () => {
    const helmfileYamlWithoutRepositories = codeBlock`
    bases:
      - ../helmfile-defaults.yaml
    releases:
      - name: backstage
        chart: backstage/backstage
        version: 0.12.0
    `;
    const lockFileWithoutRepositories = codeBlock`
    version: 0.151.0
    dependencies:
    - name: backstage
      repository: https://backstage.github.io/charts
      version: 0.11.0
    digest: sha256:e284706b71f37b757a536703da4cb148d67901afbf1ab431f7d60a9852ca6eef
    generated: "2023-03-08T21:32:06.122276997+01:00"
    `;
    const lockFileTwoWithoutRepositories = codeBlock`
    version: 0.151.0
    dependencies:
    - name: backstage
      repository: https://backstage.github.io/charts
      version: 0.12.0
    digest: sha256:9d83889176d005effb86041d30c20361625561cbfb439cbd16d7243225bac17c
    generated: "2023-03-08T21:30:48.273709455+01:00"
    `;

    git.getFile.mockResolvedValueOnce(lockFileWithoutRepositories as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(
      lockFileTwoWithoutRepositories as never,
    );
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYamlWithoutRepositories,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'helmfile.lock',
          contents: lockFileTwoWithoutRepositories,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'helmfile deps -f helmfile.yaml' },
    ]);
  });

  it('log into private OCI registries, returns updated helmfile.lock', async () => {
    const helmfileYamlOCIPrivateRepo = codeBlock`
    repositories:
      - name: private-charts
        url: ghcr.io/charts
        oci: true
    releases:
      - name: chart
        chart: private-charts/chart
        version: 0.12.0
    `;
    const lockFileOCIPrivateRepo = codeBlock`
    version: 0.151.0
    dependencies:
    - name: chart
      repository: oci://ghcr.io/private-charts
      version: 0.11.0
    digest: sha256:e284706b71f37b757a536703da4cb148d67901afbf1ab431f7d60a9852ca6eef
    generated: "2023-03-08T21:32:06.122276997+01:00"
    `;
    const lockFileOCIPrivateRepoTwo = codeBlock`
    version: 0.151.0
    dependencies:
    - name: chart
      repository: oci://ghcr.io/private-charts
      version: 0.12.0
    digest: sha256:9d83889176d005effb86041d30c20361625561cbfb439cbd16d7243225bac17c
    generated: "2023-03-08T21:30:48.273709455+01:00"
    `;
    hostRules.add({
      username: 'test',
      password: 'password',
      hostType: 'docker',
      matchHost: 'ghcr.io',
    });

    git.getFile.mockResolvedValueOnce(lockFileOCIPrivateRepo as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFileOCIPrivateRepoTwo as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYamlOCIPrivateRepo,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'helmfile.lock',
          contents: lockFileOCIPrivateRepoTwo,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'helm registry login --username test --password password ghcr.io',
        options: {
          env: {
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
        cmd: 'helmfile deps -f helmfile.yaml',
        options: {
          env: {
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

  it.each([
    {
      binarySource: 'docker',
      expectedCommands: [
        { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
            '-e HELM_EXPERIMENTAL_OCI ' +
            '-e HELM_REGISTRY_CONFIG ' +
            '-e HELM_REPOSITORY_CONFIG ' +
            '-e HELM_REPOSITORY_CACHE ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool helm v3.7.2' +
            ' && ' +
            'install-tool helmfile 0.151.0' +
            ' && ' +
            'install-tool kustomize 5.0.0' +
            ' && ' +
            'helmfile deps -f helmfile.yaml' +
            '"',
        },
      ],
    },
    {
      binarySource: 'install',
      expectedCommands: [
        { cmd: 'install-tool helm v3.7.2' },
        { cmd: 'install-tool helmfile 0.151.0' },
        { cmd: 'install-tool kustomize 5.0.0' },
        { cmd: 'helmfile deps -f helmfile.yaml' },
      ],
    },
  ])(
    'returns updated helmfile.lock with binarySource=$binarySource',
    async ({ binarySource, expectedCommands }) => {
      GlobalConfig.set({ ...adminConfig, binarySource });
      fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
      git.getFile.mockResolvedValueOnce(lockFile);
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce(lockFileTwo);
      fs.privateCacheDir.mockReturnValue(
        '/tmp/renovate/cache/__renovate-private-cache',
      );
      fs.getParentDir.mockReturnValue('');
      // helm
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v3.7.2' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '5.0.0' }],
      });
      const updatedDeps = [
        { depName: 'dep1', managerData: { needKustomize: true } },
      ];
      expect(
        await helmfile.updateArtifacts({
          packageFileName: 'helmfile.yaml',
          updatedDeps,
          newPackageFileContent: helmfileYaml,
          config,
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'helmfile.lock',
            contents: lockFileTwo,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject(expectedCommands);
    },
  );

  it.each([
    'not found',
    "Error: cannot load Chart.lock: error converting YAML to JSON: yaml: line 1: did not find expected ',' or '}'",
  ])('catches error: %s', async (errorMessage) => {
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    git.getFile.mockResolvedValueOnce(lockFile);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYaml,
        config,
      }),
    ).toEqual([
      {
        artifactError: {
          lockFile: 'helmfile.lock',
          stderr: errorMessage,
        },
      },
    ]);
  });
});
