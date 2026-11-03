import { codeBlock } from 'common-tags';
import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { DateTime } from 'luxon';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/host-rules.ts';
import { env, fs, logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import * as _datasource from '../../datasource/index.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types.ts';
import { getPoetryRequirement, getPythonConstraint } from './artifacts.ts';
import { updateArtifacts } from './index.ts';

const pyproject1toml = Fixtures.get('pyproject.1.toml');
const pyproject10toml = Fixtures.get('pyproject.10.toml');
const pyproject13toml = `[[tool.poetry.source]]
name = "some-gar-repo"
url = "https://someregion-python.pkg.dev/some-project/some-repo/simple/"

[build-system]
requires = ["poetry_core>=1.0", "wheel"]
build-backend = "poetry.masonry.api"
`;

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('google-auth-library');

process.env.CONTAINERBASE = 'true';

const datasource = vi.mocked(_datasource);
const googleAuth = vi.mocked(_googleAuth);

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  binarySource: 'global',
};

const config: UpdateArtifactsConfig = {};

function releasedDaysAgo(days: number): Timestamp {
  return DateTime.now().minus({ days }).toISO() as Timestamp;
}

describe('modules/manager/poetry/artifacts', () => {
  describe('getPythonConstraint', () => {
    const pythonVersion = '3.11.3';
    const poetryLock = codeBlock`
      [metadata]
      python-versions = "${pythonVersion}"
    `;

    it('detects from pyproject.toml', () => {
      const pythonVersion = '3.11.5';
      const pyprojectContent = codeBlock`
        [tool.poetry.dependencies]
        python = "${pythonVersion}"
      `;
      expect(getPythonConstraint(pyprojectContent, poetryLock)).toBe(
        pythonVersion,
      );
    });

    it('detects from poetry.ock', () => {
      expect(getPythonConstraint('', poetryLock)).toBe(pythonVersion);
    });
  });

  describe('getPoetryRequirement', () => {
    const poetry12lock = Fixtures.get('poetry12.lock');
    const poetry142lock = Fixtures.get('poetry142.lock');

    it('detects poetry from first line of poetry.lock', () => {
      const pyprojectContent = '';
      expect(getPoetryRequirement(pyprojectContent, poetry142lock)).toBe(
        '1.4.2',
      );
    });

    it('detects poetry from metadata', () => {
      const pyprojectContent = '';
      expect(getPoetryRequirement(pyprojectContent, poetry12lock)).toBe(
        '<1.3.0',
      );
    });
  });

  describe('updateArtifacts', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('returns null if no poetry.lock found', async () => {
      const execSnapshots = mockExecAll();
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config,
        }),
      ).resolves.toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if updatedDeps is empty', async () => {
      const execSnapshots = mockExecAll();
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config,
        }),
      ).resolves.toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
      fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config,
        }),
      ).resolves.toBeNull();
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
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '{}',
          config,
        }),
      ).resolves.toEqual([
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
      hostRules.add({
        hostType: 'pypi',
        matchHost: 'https://some.url',
        username: 'usernameOne',
        password: 'passwordOne',
      });
      hostRules.add({
        hostType: 'pypi',
        matchHost: 'https://another.url',
        username: 'usernameTwo',
      });
      hostRules.add({
        matchHost: 'https://last.url',
        password: 'passwordFour',
      });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject10toml,
          config,
        }),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'pyproject.lock',
            contents: 'New poetry.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'poetry update --lock --no-interaction dep1',
          options: {
            env: {
              POETRY_HTTP_BASIC_ONE_PASSWORD: 'passwordOne',
              POETRY_HTTP_BASIC_ONE_USERNAME: 'usernameOne',
              POETRY_HTTP_BASIC_TWO_USERNAME: 'usernameTwo',
              POETRY_HTTP_BASIC_FOUR_OH_FOUR_PASSWORD: 'passwordFour',
            },
          },
        },
      ]);
    });

    it('passes Google Artifact Registry credentials environment vars', async () => {
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(null);
      // pyproject.lock
      fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
      fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      googleAuth.mockImplementationOnce(
        // TODO: fix typing
        vi.fn<any>(
          class {
            getAccessToken = vi.fn().mockResolvedValue('some-token');
          },
        ),
      );
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject13toml,
          config,
        }),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'pyproject.lock',
            contents: 'New poetry.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'poetry update --lock --no-interaction dep1',
          options: {
            env: {
              POETRY_HTTP_BASIC_SOME_GAR_REPO_USERNAME: 'oauth2accesstoken',
              POETRY_HTTP_BASIC_SOME_GAR_REPO_PASSWORD: 'some-token',
            },
          },
        },
      ]);
    });

    it('falls back to Google auth when the matching rule has no credentials', async () => {
      hostRules.add({
        matchHost: 'someregion-python.pkg.dev',
        enabled: true,
      });
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(null);
      // pyproject.lock
      fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
      fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      googleAuth.mockImplementationOnce(
        // TODO: fix typing
        vi.fn<any>(
          class {
            getAccessToken = vi.fn().mockResolvedValue('some-token');
          },
        ),
      );
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject13toml,
          config,
        }),
      ).resolves.not.toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'poetry update --lock --no-interaction dep1',
          options: {
            env: {
              POETRY_HTTP_BASIC_SOME_GAR_REPO_USERNAME: 'oauth2accesstoken',
              POETRY_HTTP_BASIC_SOME_GAR_REPO_PASSWORD: 'some-token',
            },
          },
        },
      ]);
    });

    it('continues if Google auth is not configured', async () => {
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(null);
      // pyproject.lock
      fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
      fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      googleAuth.mockImplementation(
        // TODO: fix typing
        vi.fn<any>(
          class {
            getAccessToken = vi.fn();
          },
        ),
      );
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject13toml,
          config,
        }),
      ).resolves.toEqual([
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

    it('prioritizes pypi-scoped credentials', async () => {
      const execSnapshots = mockExecAll();
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(null);
      // pyproject.lock
      fs.getSiblingFileName.mockReturnValueOnce('pyproject.lock');
      fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      hostRules.add({ password: 'unscoped-password' });
      hostRules.add({ hostType: 'pypi', password: 'scoped-password' });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: `
          [[tool.poetry.source]]
          name = "one"
          url = "some.url"
        `,
          config,
        }),
      ).resolves.toEqual([
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
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '{}',
          config,
        }),
      ).resolves.toEqual([
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
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
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
      // poetry
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.0' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject1toml,
          config: {
            ...config,
            constraints: {
              python: '~2.7 || ^3.4',
            },
          },
        }),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'poetry.lock',
            contents: 'New poetry.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CI ' +
            '-e PIP_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool python 3.4.2 ' +
            '&& ' +
            'install-tool poetry 1.2.0 ' +
            '&& ' +
            'poetry update --lock --no-interaction dep1' +
            "'",
        },
      ]);
    });

    it('supports docker mode with github credentials', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      hostRules.add({
        token: 'some-token',
        hostType: 'github',
        matchHost: 'api.github.com',
      });
      hostRules.add({
        token: 'some-other-token',
        matchHost: 'https://gitea.com',
      });
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
      // poetry
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.0' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject1toml,
          config: {
            ...config,
            constraints: {
              python: '~2.7 || ^3.4',
            },
          },
        }),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'poetry.lock',
            contents: 'New poetry.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CI ' +
            '-e PIP_CACHE_DIR ' +
            '-e GIT_CONFIG_KEY_0 ' +
            '-e GIT_CONFIG_VALUE_0 ' +
            '-e GIT_CONFIG_KEY_1 ' +
            '-e GIT_CONFIG_VALUE_1 ' +
            '-e GIT_CONFIG_KEY_2 ' +
            '-e GIT_CONFIG_VALUE_2 ' +
            '-e GIT_CONFIG_COUNT ' +
            '-e GIT_CONFIG_KEY_3 ' +
            '-e GIT_CONFIG_VALUE_3 ' +
            '-e GIT_CONFIG_KEY_4 ' +
            '-e GIT_CONFIG_VALUE_4 ' +
            '-e GIT_CONFIG_KEY_5 ' +
            '-e GIT_CONFIG_VALUE_5 ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool python 3.4.2 ' +
            '&& ' +
            'install-tool poetry 1.2.0 ' +
            '&& ' +
            'poetry update --lock --no-interaction dep1' +
            "'",
        },
      ]);
    });

    it('returns updated poetry.lock using docker (constraints)', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();

      fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(
        '[metadata]\npython-versions = "~2.7 || ^3.4"',
      );
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      // python
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
      });
      // poetry
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.0.0' }, { version: '1.2.0' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject1toml,
          config: {
            ...config,
            constraints: {},
          },
        }),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'poetry.lock',
            contents: 'New poetry.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CI ' +
            '-e PIP_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool python 2.7.5 ' +
            '&& ' +
            'install-tool poetry 1.2.0 ' +
            '&& ' +
            'poetry update --lock --no-interaction dep1' +
            "'",
        },
      ]);
    });

    it('returns updated poetry.lock using install mode', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce(
        '[metadata]\npython-versions = "~2.7 || ^3.4"',
      );
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      // python
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
      });
      // poetry
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.0' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyproject1toml,
          config: {
            ...config,
            constraints: {},
          },
        }),
      ).resolves.toEqual([
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
        { cmd: 'install-tool poetry 1.2.0' },
        { cmd: 'poetry update --lock --no-interaction dep1' },
      ]);
    });

    it('falls back to the extracted python constraint', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      // python
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '3.3.2' }],
      });
      // poetry
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.0' }],
      });

      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [{ depName: 'dep1' }],
          // neither the pyproject nor the lock file pin python
          newPackageFileContent: '[tool.poetry.dependencies]\ndep1 = "1.0"',
          config: {
            ...config,
            extractedConstraints: { python: '~2.7 || ^3.4' },
          },
        }),
      ).resolves.not.toBeNull();

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool python 2.7.5' },
        { cmd: 'install-tool poetry 1.2.0' },
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
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '{}',
          config,
        }),
      ).resolves.toMatchObject([
        { artifactError: { fileName: 'poetry.lock' } },
      ]);
      expect(execSnapshots).toMatchObject([]);
    });

    it('returns updated poetry.lock when doing lockfile maintenance', async () => {
      const execSnapshots = mockExecAll();
      // poetry.lock
      fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old poetry.lock');
      fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        }),
      ).resolves.toEqual([
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

    describe('without minimumReleaseAgePackageManagerSync', () => {
      it('sets POETRY_SOLVER_MIN_RELEASE_AGE from minimumReleaseAge config', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        const updatedDeps = [{ depName: 'dep1' }];
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config: { ...config, minimumReleaseAge: '7 days' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '7',
              }),
            },
          },
        ]);
      });

      it('does not set POETRY_SOLVER_MIN_RELEASE_AGE when minimumReleaseAge is an invalid duration', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        const updatedDeps = [{ depName: 'dep1' }];
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config: { ...config, minimumReleaseAge: 'not-a-duration' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.not.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: expect.anything(),
              }),
            },
          },
        ]);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { minimumReleaseAge: 'not-a-duration' },
          'Invalid minimumReleaseAge, skipping POETRY_SOLVER_MIN_RELEASE_AGE',
        );
      });

      it('rounds up sub-day durations to 1 day for POETRY_SOLVER_MIN_RELEASE_AGE', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        const updatedDeps = [{ depName: 'dep1' }];
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config: { ...config, minimumReleaseAge: '12 hours' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '1',
              }),
            },
          },
        ]);
      });

      it('sets POETRY_SOLVER_MIN_RELEASE_AGE to 0 for "0 days"', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        const updatedDeps = [{ depName: 'dep1' }];
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config: { ...config, minimumReleaseAge: '0 days' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '0',
              }),
            },
          },
        ]);
      });

      it('does not set POETRY_SOLVER_MIN_RELEASE_AGE when minimumReleaseAge is not configured', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        const updatedDeps = [{ depName: 'dep1' }];
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.not.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: expect.anything(),
              }),
            },
          },
        ]);
      });

      it('passes minimumReleaseAge of the config without reading poetry.toml or excluding packages', async () => {
        const execSnapshots = mockExecAll();
        fs.getSiblingFileName.mockReturnValueOnce('poetry.lock');
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');

        const res = await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAge: null,
              minimumReleaseAgePackageManagerSync: false,
              minimumReleaseAgeRepository: '3 days',
              releaseTimestamp: releasedDaysAgo(1),
            },
          ],
          newPackageFileContent: '',
          config: {
            ...config,
            minimumReleaseAge: '14 days',
            minimumReleaseAgeRepository: '3 days',
          },
        });

        expect(res).toEqual([
          {
            file: {
              type: 'addition',
              path: 'poetry.lock',
              contents: 'New poetry.lock',
            },
          },
        ]);
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '14',
              }),
            },
          },
        ]);
      });

      it('ignores minimumReleaseAgePackageManager', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAge: '3 days',
              minimumReleaseAgePackageManager: '7 days',
            },
          ],
          newPackageFileContent: '',
          config: {
            ...config,
            minimumReleaseAge: '3 days',
            minimumReleaseAgePackageManager: '7 days',
          },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '3',
              }),
            },
          },
        ]);
      });

      it('passes minimumReleaseAge of the config for security updates', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [{ depName: 'dep1', isVulnerabilityAlert: true }],
          newPackageFileContent: '',
          config: { ...config, minimumReleaseAge: '7 days' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '7',
              }),
            },
          },
        ]);
      });
    });

    describe('with minimumReleaseAgePackageManagerSync', () => {
      const syncConfig: UpdateArtifactsConfig = {
        ...config,
        minimumReleaseAgePackageManagerSync: true,
      };

      it('sets POETRY_SOLVER_MIN_RELEASE_AGE from minimumReleaseAgeRepository', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '7 days',
              minimumReleaseAgeRepository: '7 days',
            },
          ],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '7',
              }),
            },
          },
        ]);
      });

      it('uses minimumReleaseAgeRepository instead of a larger packageRules minimumReleaseAge', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '14 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          newPackageFileContent: '',
          config: { ...syncConfig, minimumReleaseAgeRepository: '3 days' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '3',
              }),
            },
          },
        ]);
      });

      it('raises POETRY_SOLVER_MIN_RELEASE_AGE to minimumReleaseAgePackageManager', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '5 days',
              minimumReleaseAgePackageManager: '5 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '5',
              }),
            },
          },
        ]);
      });

      it('rounds up sub-day durations to 1 day for POETRY_SOLVER_MIN_RELEASE_AGE', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'poetry',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '12 hours',
              minimumReleaseAgeRepository: '12 hours',
            },
          ],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '1',
              }),
            },
          },
        ]);
      });

      async function runYoung(
        updatedDeps: UpdateArtifact['updatedDeps'],
      ): Promise<NodeJS.ProcessEnv | undefined> {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '',
          config: syncConfig,
        });
        return execSnapshots[0].options?.env;
      }

      it('excludes a young update without minimumReleaseAge and keeps the age', async () => {
        const env = await runYoung([
          {
            depName: 'mycorp-lib',
            manager: 'poetry',
            newValue: '1.2.3',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: null,
            minimumReleaseAgeRepository: '3 days',
            releaseTimestamp: releasedDaysAgo(1),
          },
        ]);
        expect(env).toMatchObject({
          POETRY_SOLVER_MIN_RELEASE_AGE: '3',
          POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: 'mycorp-lib',
        });
      });

      it('excludes all young updates with a smaller minimumReleaseAge', async () => {
        const env = await runYoung([
          {
            depName: 'dep1',
            manager: 'poetry',
            newValue: '1.2.3',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '2 days',
            minimumReleaseAgeRepository: '7 days',
            releaseTimestamp: releasedDaysAgo(3),
          },
          {
            depName: 'Dep_2',
            manager: 'poetry',
            newValue: '1.2.3',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '36 hours',
            minimumReleaseAgeRepository: '7 days',
          },
          {
            depName: 'dep3',
            manager: 'poetry',
            newValue: '1.2.3',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '7 days',
            minimumReleaseAgeRepository: '7 days',
            releaseTimestamp: releasedDaysAgo(1),
          },
        ]);
        expect(env).toMatchObject({
          POETRY_SOLVER_MIN_RELEASE_AGE: '7',
          POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: 'dep1,dep-2',
        });
      });

      it('excludes only updates which pin a single version', async () => {
        const env = await runYoung([
          {
            depName: 'pinned',
            manager: 'poetry',
            newValue: '1.35.50',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '7 days',
          },
          {
            depName: 'equals',
            manager: 'poetry',
            newValue: '==1.35.50',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '7 days',
          },
          {
            depName: 'caret',
            manager: 'poetry',
            newValue: '^1.35.50',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '7 days',
          },
          {
            depName: 'no-value',
            manager: 'poetry',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '7 days',
          },
        ]);
        expect(env).toMatchObject({
          POETRY_SOLVER_MIN_RELEASE_AGE: '7',
          POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: 'pinned',
        });
      });

      it('sets no exclude if the constraint of an exempted update is a range', async () => {
        const env = await runYoung([
          {
            depName: 'boto3',
            manager: 'poetry',
            newValue: '^1.35.50',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: null,
            minimumReleaseAgeRepository: '3 days',
          },
        ]);
        expect(env).toMatchObject({ POETRY_SOLVER_MIN_RELEASE_AGE: '3' });
        expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE');
      });

      it('does not exclude a release older than minimumReleaseAgeRepository', async () => {
        const env = await runYoung([
          {
            depName: 'dep1',
            manager: 'poetry',
            newValue: '1.2.3',
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgeRepository: '7 days',
            releaseTimestamp: releasedDaysAgo(10),
          },
        ]);
        expect(env).toMatchObject({ POETRY_SOLVER_MIN_RELEASE_AGE: '7' });
        expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE');
      });

      describe('with solver.min-release-age in poetry.toml', () => {
        async function runWithPoetryToml(
          poetryToml: string,
          updatedDeps: UpdateArtifact['updatedDeps'],
        ): Promise<{
          env: NodeJS.ProcessEnv | undefined;
          res: UpdateArtifactsResult[] | null;
        }> {
          const execSnapshots = mockExecAll();
          fs.ensureCacheDir.mockResolvedValueOnce(
            '/tmp/renovate/cache/others/pip',
          );
          fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
          fs.readLocalFile.mockResolvedValueOnce(poetryToml);
          fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
          const res = await updateArtifacts({
            packageFileName: 'pyproject.toml',
            updatedDeps,
            newPackageFileContent: '',
            config: syncConfig,
          });
          return { env: execSnapshots[0].options?.env, res };
        }

        it('passes the minimum release age of Renovate if it is larger', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 3
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '7 days',
                minimumReleaseAgeRepository: '7 days',
              },
            ],
          );
          expect(env).toMatchObject({ POETRY_SOLVER_MIN_RELEASE_AGE: '7' });
        });

        it('does not pass less than a non-integer Poetry value', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 2.5
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '1 day',
              },
            ],
          );
          expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE');
        });

        it('passes no age if the Poetry value is not smaller', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 7
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '7 days',
                minimumReleaseAgeRepository: '7 days',
              },
            ],
          );
          expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE');
        });

        it('excludes an exempted update and passes the larger age of Renovate', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 2
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '4 days',
                minimumReleaseAgeRepository: '7 days',
                releaseTimestamp: releasedDaysAgo(5),
              },
            ],
          );
          expect(env).toMatchObject({
            POETRY_SOLVER_MIN_RELEASE_AGE: '7',
            POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: 'dep1',
          });
        });

        it('lists the entries of solver.min-release-age-exclude first', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age-exclude = ["My_Package"]
          `,
            [
              {
                depName: 'dep2',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '7 days',
                releaseTimestamp: releasedDaysAgo(2),
              },
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '7 days',
              },
            ],
          );
          expect(env).toMatchObject({
            POETRY_SOLVER_MIN_RELEASE_AGE: '7',
            POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: 'my-package,dep2,dep1',
          });
        });

        it('does not exclude a release younger than solver.min-release-age', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 7
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '3 days',
                releaseTimestamp: releasedDaysAgo(5),
              },
            ],
          );
          expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE');
          expect(env).not.toHaveProperty(
            'POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE',
          );
        });

        it('does not exclude a release without timestamp if solver.min-release-age is set', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 2
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '7 days',
              },
            ],
          );
          expect(env).toMatchObject({ POETRY_SOLVER_MIN_RELEASE_AGE: '7' });
          expect(env).not.toHaveProperty(
            'POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE',
          );
        });

        it('does not exclude a release which Poetry accepts', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age = 3
          `,
            [
              {
                depName: 'dep1',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '2 days',
                releaseTimestamp: releasedDaysAgo(4),
              },
            ],
          );
          expect(env).not.toHaveProperty('POETRY_SOLVER_MIN_RELEASE_AGE');
          expect(env).not.toHaveProperty(
            'POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE',
          );
        });

        it('does not exclude a package of solver.min-release-age-exclude again', async () => {
          const { env } = await runWithPoetryToml(
            codeBlock`
            [solver]
            min-release-age-exclude = ["My_Package"]
          `,
            [
              {
                depName: 'My.Package',
                packageName: 'my-package',
                manager: 'poetry',
                newValue: '1.2.3',
                minimumReleaseAgePackageManagerSync: true,
                minimumReleaseAge: '1 day',
                minimumReleaseAgeRepository: '7 days',
                releaseTimestamp: releasedDaysAgo(2),
              },
            ],
          );
          expect(env).toMatchObject({ POETRY_SOLVER_MIN_RELEASE_AGE: '7' });
          expect(env).not.toHaveProperty(
            'POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE',
          );
        });
      });

      it('uses the own minimumReleaseAge for lock file maintenance', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: {
            ...syncConfig,
            isLockFileMaintenance: true,
            minimumReleaseAge: '5 days',
            minimumReleaseAgeRepository: '3 days',
          },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '5',
              }),
            },
          },
        ]);
      });

      it('reads the poetry update if a pep621 update of pyproject.toml comes first', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              manager: 'pep621',
              minimumReleaseAgeRepository: '3 days',
            },
            {
              depName: 'dep2',
              manager: 'poetry',
              minimumReleaseAgePackageManagerSync: true,
              minimumReleaseAge: '5 days',
              minimumReleaseAgePackageManager: '5 days',
              minimumReleaseAgeRepository: '3 days',
            },
          ],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '5',
              }),
            },
          },
        ]);
      });

      it('reads the poetry lock file maintenance in a branch whose first upgrade is npm', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        // poetry.toml
        fs.readLocalFile.mockResolvedValueOnce(null);
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: {
            ...syncConfig,
            isLockFileMaintenance: true,
            minimumReleaseAgePackageManager: '3 days',
            upgrades: [
              {
                isLockFileMaintenance: true,
                manager: 'npm',
                packageFile: 'package.json',
                minimumReleaseAgePackageManager: '3 days',
              },
              {
                isLockFileMaintenance: true,
                manager: 'poetry',
                minimumReleaseAgePackageManagerSync: true,
                packageFile: 'pyproject.toml',
                minimumReleaseAgePackageManager: '5 days',
              },
            ],
          },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: '5',
              }),
            },
          },
        ]);
      });

      it('does not set POETRY_SOLVER_MIN_RELEASE_AGE for security updates', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [
            {
              depName: 'dep1',
              isVulnerabilityAlert: true,
              minimumReleaseAgeRepository: '7 days',
            },
          ],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.not.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: expect.anything(),
              }),
            },
          },
        ]);
      });

      it('does not set POETRY_SOLVER_MIN_RELEASE_AGE when only minimumReleaseAge is configured', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [{ depName: 'dep1', minimumReleaseAge: '7 days' }],
          newPackageFileContent: '',
          config: { ...syncConfig, minimumReleaseAge: '7 days' },
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.not.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: expect.anything(),
              }),
            },
          },
        ]);
      });

      it('does not set POETRY_SOLVER_MIN_RELEASE_AGE when minimumReleaseAgeRepository is not configured', async () => {
        const execSnapshots = mockExecAll();
        fs.ensureCacheDir.mockResolvedValueOnce(
          '/tmp/renovate/cache/others/pip',
        );
        fs.readLocalFile.mockResolvedValueOnce('Current poetry.lock');
        fs.readLocalFile.mockResolvedValueOnce('New poetry.lock');
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [{ depName: 'dep1' }],
          newPackageFileContent: '',
          config: syncConfig,
        });
        expect(execSnapshots).toMatchObject([
          {
            options: {
              env: expect.not.objectContaining({
                POETRY_SOLVER_MIN_RELEASE_AGE: expect.anything(),
              }),
            },
          },
        ]);
      });
    });
  });
});
