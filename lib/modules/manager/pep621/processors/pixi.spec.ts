import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import * as docker from '../../../../util/exec/docker/index.ts';
import { getPkgReleases as _getPkgReleases } from '../../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../../types.ts';
import { parsePyProject } from '../extract.ts';
import { PixiProcessor } from './pixi.ts';

vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../datasource/index.ts');

const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  allowedUnsafeExecutions: ['pixi'],
};

const processor = new PixiProcessor();

describe('modules/manager/pep621/processors/pixi', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  describe('process()', () => {
    it('returns deps unchanged', () => {
      const deps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = processor.process(parsePyProject('')!, deps);

      expect(result).toEqual(deps);
    });
  });

  describe('extractLockedVersions()', () => {
    it('returns deps unchanged', async () => {
      const deps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = await processor.extractLockedVersions(
        parsePyProject('')!,
        deps,
        'pyproject.toml',
      );

      expect(result).toEqual(deps);
    });
  });

  describe('getLockfiles()', () => {
    it('returns pixi.lock when found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockResolvedValueOnce(true);

      const result = await processor.getLockfiles(
        parsePyProject('')!,
        'pyproject.toml',
      );

      expect(result).toEqual(['pixi.lock']);
    });

    it('returns empty array when pixi.lock not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockResolvedValueOnce(false);

      const result = await processor.getLockfiles(
        parsePyProject('')!,
        'pyproject.toml',
      );

      expect(result).toEqual([]);
    });
  });

  describe('updateArtifacts()', () => {
    it('throws TEMPORARY_ERROR', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.ensureCacheDir.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));

      const result = processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      await expect(result).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('returns null when no updated deps and not lock file maintenance', async () => {
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null when pixi.lock does not exist', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null when pixi is not in allowedUnsafeExecutions', async () => {
      GlobalConfig.set({ ...adminConfig, allowedUnsafeExecutions: [] });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null when lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('returns updated pixi.lock for dep update', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
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

    it('returns updated pixi.lock for dep update using docker', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi version lookup
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.41.4' }, { version: '0.42.0' }],
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
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
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool pixi 0.42.0 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            '"',
        },
      ]);
    });

    it('returns updated pixi.lock for lock file maintenance', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { isLockFileMaintenance: true },
          updatedDeps: [],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(fs.deleteLocalFile).toHaveBeenCalledWith('pixi.lock');
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('uses requires-pixi version constraint from pyproject.toml', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      const project = parsePyProject(`
[tool.pixi.project]
name = "test"
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.40,<0.41"
`);

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: {} },
          updatedDeps: [{ depName: 'dep1' }],
        },
        project!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
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
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool pixi 0.40.1 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            '"',
        },
      ]);
    });

    it('uses requires-pixi version constraint from workspace table', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      const project = parsePyProject(`
[tool.pixi.workspace]
name = "test"
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.40,<0.41"
`);

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: {} },
          updatedDeps: [{ depName: 'dep1' }],
        },
        project!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
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
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool pixi 0.40.1 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            '"',
        },
      ]);
    });

    it('uses pixi version constraint from config.constraints', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.40.1' }, { version: '0.41.4' }],
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: { pixi: '>=0.40,<0.41' } },
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
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
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool pixi 0.40.1 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            '"',
        },
      ]);
    });

    it('returns artifact error on exec failure', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockImplementationOnce(() => {
        throw new Error('exec failed');
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          artifactError: {
            fileName: 'pixi.lock',
            stderr: 'Error: exec failed',
          },
        },
      ]);
      expect(execSnapshots).toEqual([]);
    });
  });
});
