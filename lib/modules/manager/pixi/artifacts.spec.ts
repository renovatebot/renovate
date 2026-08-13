import { codeBlock } from 'common-tags';
import upath from 'upath';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import * as _datasource from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const datasource = vi.mocked(_datasource);

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
  binarySource: 'global',
  allowedUnsafeExecutions: ['pixi'],
};

const config: UpdateArtifactsConfig = {};

// The exec flow, the `allowedUnsafeExecutions` gate, and the error handling
// live in the shared `updatePixiLockfile` helper and are covered by
// `lockfile.spec.ts`. These tests only assert the `pixi` manager's own
// behavior: how it derives the `pixi` constraint and that it delegates while
// writing the updated package file.
describe('modules/manager/pixi/artifacts', () => {
  describe('updateArtifacts', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('writes the updated package file and returns the new pixi.lock', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        newPackageFileContent: '',
        config,
      });

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(fs.writeLocalFile).toHaveBeenCalledWith('pyproject.toml', '');
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('derives the pixi constraint from requires-pixi in the package file', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 5');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });

      const result = await updateArtifacts({
        packageFileName: 'pixi.toml',
        updatedDeps: [{ depName: 'dep1' }],
        newPackageFileContent: codeBlock`
          [project]
          authors = []
          channels = ["conda-forge"]
          name = "data"
          platforms = ["win-64"]
          version = "0.1.0"
          requires-pixi = '>=0.40,<0.41'

          [dependencies]
          python = "3.12.*"
        `,
        config: { ...config, constraints: {} },
      });

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
        { cmd: 'install-tool pixi 0.40.1' },
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('prefers config.constraints.pixi over the package file requires-pixi', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('version: 5');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });

      const result = await updateArtifacts({
        packageFileName: 'pixi.toml',
        updatedDeps: [{ depName: 'dep1' }],
        newPackageFileContent: codeBlock`
          [project]
          authors = []
          channels = ["conda-forge"]
          name = "data"
          platforms = ["win-64"]
          version = "0.1.0"
          requires-pixi = '>=0.38,<0.39'

          [dependencies]
          python = "3.12.*"
        `,
        config: { ...config, constraints: { pixi: '>=0.40,<0.41' } },
      });

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
        { cmd: 'install-tool pixi 0.40.1' },
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });
  });
});
