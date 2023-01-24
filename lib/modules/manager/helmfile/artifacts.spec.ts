import { codeBlock } from 'common-tags';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as helmfile from '.';

jest.mock('../../datasource');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const datasource = mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
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
version: 0.150.0
dependencies:
- name: backstage
  repository: https://backstage.github.io/charts
  version: 0.11.0
- name: oauth2-proxy
  repository: https://oauth2-proxy.github.io/manifests
  version: 6.2.1
digest: sha256:98c605fc3de51960ad1eb022f01dfae3bb0a1a06549e56fa39ec86db2a9a072d
generated: "2023-01-23T12:13:46.487247+01:00"
`;
const lockFileTwo = codeBlock`
version: 0.150.0
dependencies:
- name: backstage
  repository: https://backstage.github.io/charts
  version: 0.12.0
- name: oauth2-proxy
  repository: https://oauth2-proxy.github.io/manifests
  version: 6.8.0
digest: sha256:8ceea14d17c0f3c108a26ba341c63380e2426db66484d2b2876ab6e636e52af4
generated: "2023-01-23T12:16:41.881988+01:00"
`;

describe('modules/manager/helmfile/artifacts', () => {
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

  it('returns null if no helmfile.lock found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(lockFile as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFile as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps: [{ depName: 'dep1' }],
        newPackageFileContent: helmfileYaml,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'helmfile deps -f helmfile.yaml' },
    ]);
  });

  it('returns updated helmfile.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(lockFile as never);
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFileTwo as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYaml,
        config,
      })
    ).toMatchObject([
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

  it('returns updated helmfile.lock with docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(lockFile as never);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(lockFileTwo as never);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.getParentDir.mockReturnValue('');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v0.129.0' }],
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await helmfile.updateArtifacts({
        packageFileName: 'helmfile.yaml',
        updatedDeps,
        newPackageFileContent: helmfileYaml,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'helmfile.lock',
          contents: lockFileTwo,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(3);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool helmfile v0.129.0' +
          ' && ' +
          'helmfile deps -f helmfile.yaml' +
          '"',
      },
    ]);
  });

  it.each([
    'not found',
    "Error: cannot load Chart.lock: error converting YAML to JSON: yaml: line 1: did not find expected ',' or '}'",
  ])('catches error: %s', async (errorMessage) => {
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(lockFile as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
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
      })
    ).toMatchObject([
      {
        artifactError: {
          lockFile: 'helmfile.lock',
          stderr: errorMessage,
        },
      },
    ]);
  });
});
