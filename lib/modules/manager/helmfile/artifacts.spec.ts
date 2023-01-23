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

const helmfileYaml = Fixtures.get('helmfile.yaml');
const lockFile = Fixtures.get('helmfile.lock');
const lockFileTwo = Fixtures.get('helmfile-two.lock');

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
        file: {
          type: 'addition',
          path: 'helmfile.lock',
          contents: lockFileTwo,
        },
      },
    ]);
    expect(execSnapshots).toBeArrayOfSize(1);
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
    ).toMatchObject([
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
          ' &&' +
          ' helmfile deps -f helmfile.yaml' +
          '"',
      },
    ]);
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('helmfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(lockFile as any);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache'
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
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
          stderr: 'not found',
        },
      },
    ]);
  });
});
