import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs, logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases as _getPkgReleases } from '../../datasource/index.ts';
import type { Upgrade } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts');

const getPkgReleases = vi.mocked(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/pep723/artifacts', () => {
  describe('updateArtifacts', () => {
    it('throws TEMPORARY_ERROR', async () => {
      fs.readLocalFile.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));

      const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });

      await expect(result).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('returns null if no lock file is found', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const updatedDeps = [{ depName: 'dep1' }];

      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });

      expect(result).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { lockFileName: 'foo.py.lock' },
        'No uv lock file found',
      );
    });

    it('returns null if the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');

      const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });
      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --script foo.py --upgrade-package dep1 --upgrade-package dep2',
        },
      ]);
    });

    it('returns null on non-lock file maintenance empty updates', async () => {
      GlobalConfig.set(adminConfig);

      const updatedDeps: Upgrade[] = [];

      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });
      expect(result).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'No dependencies to update',
      );
    });

    it('returns artifact error', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.readLocalFile.mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const updatedDeps = [{ depName: 'dep1' }];
      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });

      expect(result).toEqual([
        { artifactError: { lockFile: 'foo.py.lock', stderr: 'test error' } },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('return update on dep update', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');

      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.28' }, { version: '0.2.35' }],
      });

      const updatedDeps = [{ depName: 'dep1' }, { depName: 'dep2' }];
      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });

      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'foo.py.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/renovatebot/base-image',
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            'bash -l -c "' +
            'install-tool python 3.11.2 ' +
            '&& ' +
            'install-tool uv 0.2.35 ' +
            '&& ' +
            'uv lock --script foo.py --upgrade-package dep1 --upgrade-package dep2' +
            '"',
        },
      ]);
    });

    it('return update on lockfileMaintenance', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');

      const result = await updateArtifacts({
        packageFileName: 'foo.py',
        newPackageFileContent: '',
        config: {
          isLockFileMaintenance: true,
        },
        updatedDeps: [],
      });

      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'foo.py.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --script foo.py --upgrade',
        },
      ]);
    });
  });
});
