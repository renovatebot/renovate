import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../../config/types.ts';
import * as docker from '../../../../util/exec/docker/index.ts';
import { getPkgReleases as _getPkgReleases } from '../../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../../types.ts';
import { parsePyProject } from '../extract.ts';
import { PixiProcessor } from './pixi.ts';

vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../datasource/index.ts');

const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
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

  // The exec flow, the `allowedUnsafeExecutions` gate, and the error handling
  // live in the shared `updatePixiLockfile` helper and are covered by
  // `../../pixi/lockfile.spec.ts`. These tests only assert the `pep621`
  // processor's own behavior: how it derives the `pixi` constraint and that it
  // delegates without writing the package file (the `pep621` manager writes it
  // elsewhere).
  describe('updateArtifacts()', () => {
    it('delegates to the shared helper without writing the package file', async () => {
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
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('derives the pixi constraint from requires-pixi in the pyproject', async () => {
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

    it('prefers config.constraints.pixi over the pyproject requires-pixi', async () => {
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
requires-pixi = ">=0.38,<0.39"
`);

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: { pixi: '>=0.40,<0.41' } },
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
  });
});
