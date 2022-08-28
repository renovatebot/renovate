import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

const pyproject1toml = Fixtures.get('pyproject.1.toml');
const pyproject10toml = Fixtures.get('pyproject.10.toml');

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../datasource');
jest.mock('../../../util/host-rules');

process.env.BUILDPACK = 'true';

const datasource = mocked(_datasource);
const hostRules = mocked(_hostRules);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/poetry/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  it('returns null if no poetry.lock found', async () => {
    const execSnapshots = mockExecAll();
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if updatedDeps is empty', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'poetry update --lock --no-interaction dep1',
        options: {
          cwd: '/tmp/github/some/repo',
          env: { PIP_CACHE_DIR: '/tmp/renovate/cache/others/pip' },
        },
      },
    ]);
  });

  it('returns updated poetry.lock', async () => {
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'poetry.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'poetry update --lock --no-interaction dep1' },
    ]);
  });

  it('passes private credential environment vars', async () => {
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    // pyproject.lock
    fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
    fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    hostRules.find.mockReturnValueOnce({
      username: 'usernameOne',
      password: 'passwordOne',
    });
    hostRules.find.mockReturnValueOnce({ username: 'usernameTwo' });
    hostRules.find.mockReturnValueOnce({});
    hostRules.find.mockReturnValueOnce({ password: 'passwordFour' });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: pyproject10toml,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pyproject.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(hostRules.find.mock.calls).toHaveLength(4);
    expect(execSnapshots).toMatchObject([
      { cmd: 'poetry update --lock --no-interaction dep1' },
    ]);
  });

  it('prioritizes pypi-scoped credentials', async () => {
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    // pyproject.lock
    fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
    fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    hostRules.find.mockImplementation((search) => ({
      password:
        search.hostType === 'pypi' ? 'scoped-password' : 'unscoped-password',
    }));
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: `
          [[tool.poetry.source]]
          name = "one"
          url = "some.url"
        `,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pyproject.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'poetry update --lock --no-interaction dep1' },
    ]);
  });

  it('returns updated pyproject.lock', async () => {
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    // pyproject.lock
    fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
    fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'pyproject.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'poetry update --lock --no-interaction dep1' },
    ]);
  });

  it('returns updated poetry.lock using docker', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll();
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    // python
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.5' }, { version: '3.4.2' }],
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: pyproject1toml,
        config: {
          ...config,
          constraints: {
            python: '~2.7 || ^3.4',
          },
        },
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'poetry.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.4.2 ' +
          '&& ' +
          "pip install --user 'poetry>=1.0' " +
          '&& ' +
          'poetry update --lock --no-interaction dep1' +
          '"',
      },
    ]);
  });

  it('returns updated poetry.lock using docker (constraints)', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll();

    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce(
      '[metadata]\npython-versions = "~2.7 || ^3.4"'
    );
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    // python
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: pyproject1toml,
        config: {
          ...config,
          constraints: {},
        },
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'poetry.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool python 2.7.5 ' +
          '&& ' +
          "pip install --user 'poetry>=1.0' " +
          '&& ' +
          'poetry update --lock --no-interaction dep1' +
          '"',
      },
    ]);
  });

  it('returns updated poetry.lock using install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce(
      '[metadata]\npython-versions = "~2.7 || ^3.4"'
    );
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    // python
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: pyproject1toml,
        config: {
          ...config,
          constraints: {},
        },
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'poetry.lock',
          contents: 'New poetry.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 2.7.5' },
      { cmd: "pip install --user 'poetry>=1.0'" },
      { cmd: 'poetry update --lock --no-interaction dep1' },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchObject([{ artifactError: { lockFile: 'poetry.lock' } }]);
    expect(execSnapshots).toMatchObject([]);
  });

  it('returns updated poetry.lock when doing lockfile maintenance', async () => {
    const execSnapshots = mockExecAll();
    // poetry.lock
    fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old poetry.lock');
    fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          updateType: 'lockFileMaintenance',
        },
      })
    ).toEqual([
      {
        file: {
          contents: 'New poetry.lock',
          path: 'poetry.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'poetry update --lock --no-interaction' },
    ]);
  });
});
