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
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import * as _datasource from '../../datasource/index.ts';
import { updatePixiLockfile } from './lockfile.ts';

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

describe('modules/manager/pixi/lockfile', () => {
  describe('updatePixiLockfile', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('returns null when there are no updated deps and no lockfile maintenance', async () => {
      const execSnapshots = mockExecAll();

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        isLockFileMaintenance: false,
        constraint: undefined,
      });

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null when no pixi.lock exists', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
      });

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null when pixi is not in allowedUnsafeExecutions', async () => {
      GlobalConfig.set({ ...adminConfig, allowedUnsafeExecutions: [] });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
        newPackageFileContent: 'content',
      });

      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });

    it('writes the package file before running pixi lock when newPackageFileContent is set', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
        newPackageFileContent: 'new content',
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
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'pyproject.toml',
        'new content',
      );
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

    it('does not write the package file when newPackageFileContent is omitted', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
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
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('deletes the existing lock file during lockfile maintenance', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        isLockFileMaintenance: true,
        constraint: undefined,
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
      expect(fs.deleteLocalFile).toHaveBeenCalledWith('pixi.lock');
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('returns null when the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
      });

      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('passes the pixi constraint to the tool installer', async () => {
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

      const result = await updatePixiLockfile({
        packageFileName: 'pixi.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: '>=0.40,<0.41',
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

    it('throws TEMPORARY_ERROR', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.ensureCacheDir.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));

      await expect(
        updatePixiLockfile({
          packageFileName: 'pyproject.toml',
          updatedDeps: [{ depName: 'dep1' }],
          isLockFileMaintenance: false,
          constraint: undefined,
        }),
      ).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('returns an artifact error when pixi lock fails', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.ensureCacheDir.mockImplementationOnce(() => {
        throw new Error('exec failed');
      });

      const result = await updatePixiLockfile({
        packageFileName: 'pyproject.toml',
        updatedDeps: [{ depName: 'dep1' }],
        isLockFileMaintenance: false,
        constraint: undefined,
      });

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
