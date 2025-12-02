import { codeBlock } from 'common-tags';
import upath from 'upath';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import * as docker from '../../../util/exec/docker';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { env, fs } from '~test/util';

const pixiToml = `
[project]
authors = []
channels = ["conda-forge"]
name = "data"
platforms = ["win-64"]
version = "0.1.0"

[tasks]

[dependencies]
python = "3.12.*"
geographiclib = ">=2.0,<3"
geopy = ">=2.4.1,<3"
cartopy = ">=0.24.0,<0.25"
pydantic = "2.*"
matplotlib = ">=3.10.0,<4"
pyqt = ">=5.15.9,<6"
pandas = ">=2.2.3,<3"
python-dateutil = ">=2.9.0.post0,<3"
rich = ">=13.9.4,<14"
scipy = ">=1.15.2,<2"
tqdm = ">=4.67.1,<5"
tzdata = ">=2025a"
numpy = "2.*"
adjusttext = ">=1.3.0,<2"
iris = ">=3.11.1,<4"
`;

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');
vi.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const datasource = vi.mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/pixi/artifacts', () => {
  describe('updateArtifacts', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('returns null if no pixi.lock found', async () => {
      const execSnapshots = mockExecAll();
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { ...config, isLockFileMaintenance: true },
        }),
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
        }),
      ).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pixi lock --no-progress --color=never --quiet',
          options: {
            cwd: '/tmp/github/some/repo',
            env: { PIXI_CACHE_DIR: '/tmp/renovate/cache/others/pixi' },
          },
        },
      ]);
    });

    it('handle TEMPORARY_ERROR', async () => {
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.writeLocalFile.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));

      await expect(
        updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).rejects.toThrow(new Error(TEMPORARY_ERROR));
    });

    it('returns updated pixi.lock using docker', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
      });
      const execSnapshots = mockExecAll();
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 7');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '0.41.4' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pixi.toml',
          updatedDeps,
          newPackageFileContent: pixiToml,
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool pixi 0.41.4 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            '"',
        },
      ]);
    });

    it('returns updated pixi.lock using install mode', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 6');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '0.41.4' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pixiToml,
          config: {
            ...config,
            constraints: {},
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool pixi 0.41.4' },
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('returns updated pixi.lock using install mode for old version lock file', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 5');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.38.0' }, { version: '0.41.4' }],
      });
      expect(
        await updateArtifacts({
          packageFileName: 'pixi.toml',
          updatedDeps: [],
          newPackageFileContent: pixiToml,
          config: {
            ...config,
            constraints: {},
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool pixi 0.41.4' },
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('returns pixi version defined in requires-pixi', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 5');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      expect(
        await updateArtifacts({
          packageFileName: 'pixi.toml',
          updatedDeps: [],
          newPackageFileContent: codeBlock`
                              [project]
                              authors = []
                              channels = ["conda-forge"]
                              name = "data"
                              platforms = ["win-64"]
                              version = "0.1.0"
                              requires-pixi = '>=0.40,<0.41'

                              [tasks]

                              [dependencies]
                              python = "3.12.*"
                              `,
          config: {
            ...config,
            constraints: {},
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool pixi 0.40.1' },
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('catches errors', async () => {
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.writeLocalFile.mockImplementationOnce(() => {
        throw new Error('not found');
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pixi.toml',
          updatedDeps,
          newPackageFileContent: '{}',
          config,
        }),
      ).toMatchObject([{ artifactError: { lockFile: 'pixi.lock' } }]);
      expect(execSnapshots).toMatchObject([]);
    });

    it('returns updated pixi.lock when doing lockfile maintenance', async () => {
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            contents: 'New pixi.lock',
            path: 'pixi.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });
  });
});
