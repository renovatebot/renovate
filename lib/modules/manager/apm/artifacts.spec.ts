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
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/apm/artifacts', () => {
  describe('updateArtifacts', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('returns null if no updated deps and no lock file maintenance', async () => {
      const execSnapshots = mockExecAll();
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [],
          newPackageFileContent: '',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if no lock file found', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: '',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Current apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Current apm.lock.yaml');
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: 'new',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([{ cmd: 'apm install' }]);
    });

    it('returns updated apm.lock.yaml', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Old apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('New apm.lock.yaml');
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: 'new',
          config,
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'apm.lock.yaml',
            contents: 'New apm.lock.yaml',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([{ cmd: 'apm install' }]);
    });

    it('deletes lock file on lockFileMaintenance', async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Old apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('New apm.lock.yaml');
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [],
          newPackageFileContent: 'new',
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'apm.lock.yaml',
            contents: 'New apm.lock.yaml',
          },
        },
      ]);
      expect(fs.deleteLocalFile).toHaveBeenCalledWith('apm.lock.yaml');
      expect(execSnapshots).toMatchObject([{ cmd: 'apm install' }]);
    });

    it('supports docker mode with tool constraint', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Old apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('New apm.lock.yaml');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.1.0' }, { version: '0.2.0' }],
      });
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: 'new',
          config: { ...config, constraints: { apm: '0.2.0' } },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'apm.lock.yaml',
            contents: 'New apm.lock.yaml',
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
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool apm 0.2.0 ' +
            '&& ' +
            'apm install' +
            '"',
        },
      ]);
    });

    it('rethrows TEMPORARY_ERROR', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Old apm.lock.yaml');
      fs.writeLocalFile.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));
      await expect(
        updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: 'new',
          config,
        }),
      ).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('returns artifactError on failure', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apm.lock.yaml');
      fs.readLocalFile.mockResolvedValueOnce('Old apm.lock.yaml');
      fs.writeLocalFile.mockRejectedValueOnce(new Error('write failed'));
      expect(
        await updateArtifacts({
          packageFileName: 'apm.yml',
          updatedDeps: [{ depName: 'owner/repo' }],
          newPackageFileContent: 'new',
          config,
        }),
      ).toEqual([
        {
          artifactError: {
            fileName: 'apm.lock.yaml',
            stderr: 'Error: write failed',
          },
        },
      ]);
    });
  });
});
