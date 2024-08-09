import { join } from 'upath';
import { mockExecAll } from '../../../../../test/exec-util';
import { fs, mockedFunction } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import { getPkgReleases as _getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import { depTypes } from '../utils';
import { RyeProcessor } from './rye';

jest.mock('../../../../util/fs');
jest.mock('../../../datasource');

const getPkgReleases = mockedFunction(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const processor = new RyeProcessor();

describe('modules/manager/pep621/processors/rye', () => {
  describe('updateArtifacts()', () => {
    it('return null if there is no lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('requirements.lock');
      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps,
        },
        {},
      );
      expect(result).toBeNull();
    });

    it('return null if the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      fs.getSiblingFileName.mockReturnValueOnce('requirements.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // rye
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v2.6.1' }, { version: 'v2.5.0' }],
      });

      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {},
      );
      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/containerbase/sidecar',
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
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool python 3.11.2 ' +
            '&& ' +
            'install-tool rye 0.34.0 ' +
            '&& ' +
            'rye lock --update dep1' +
            '"',
        },
      ]);
    });

    it('returns artifact error', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.getSiblingFileName.mockReturnValueOnce('requirements.lock');
      fs.getSiblingFileName.mockReturnValueOnce('requirements-dev.lock');

      fs.readLocalFile.mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {},
      );
      expect(result).toEqual([
        {
          artifactError: {
            lockFile: 'requirements.lock',
            stderr: 'test error',
          },
        },
        {
          artifactError: {
            lockFile: 'requirements-dev.lock',
            stderr: 'test error',
          },
        },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('return update dep update', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('requirements.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // pdm
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v2.6.1' }, { version: 'v2.5.0' }],
      });

      const updatedDeps = [
        {
          packageName: 'dep1',
          depType: depTypes.dependencies,
        },
        { packageName: 'dep2', depType: depTypes.dependencies },
        {
          depName: 'group1/dep3',
          depType: depTypes.optionalDependencies,
        },
        { depName: 'group1/dep4', depType: depTypes.optionalDependencies },
        {
          depName: 'group2/dep5',
          depType: depTypes.ryeDevDependencies,
        },
        { depName: 'group2/dep6', depType: depTypes.ryeDevDependencies },
        {
          depName: 'group3/dep7',
          depType: depTypes.ryeDevDependencies,
        },
        { depName: 'group3/dep8', depType: depTypes.ryeDevDependencies },
        { depName: 'dep9', depType: depTypes.buildSystemRequires },
      ];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'requirements.lock',
            type: 'addition',
          },
        },
        {
          file: {
            contents: 'changed test content',
            path: 'requirements-dev.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'rye lock --update dep1',
        },
        {
          cmd: 'rye lock --update dep2',
        },
        {
          cmd: 'rye lock --feature group1 --update dep3',
        },
        {
          cmd: 'rye lock --feature group1 --update dep4',
        },
        {
          cmd: 'rye lock --feature group2 --update dep5',
        },
        {
          cmd: 'rye lock --feature group2 --update dep6',
        },
        {
          cmd: 'rye lock --feature  group3 --update dep7',
        },
        {
          cmd: 'rye lock --feature  group3 --update dep8',
        },
      ]);
    });

    it('return update on lockfileMaintenance', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('requirements.lock');
      fs.getSiblingFileName.mockReturnValueOnce('requirements-dev.lock');

      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');

      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');

      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // rye
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v2.6.1' }, { version: 'v2.5.0' }],
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'folder/pyproject.toml',
          newPackageFileContent: '',
          config: {
            updateType: 'lockFileMaintenance',
          },
          updatedDeps: [],
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'requirements.lock',
            type: 'addition',
          },
        },
        {
          file: {
            contents: 'changed test content',
            path: 'requirements-dev.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'rye lock --update-all',
          options: {
            cwd: '/tmp/github/some/repo/folder',
          },
        },
      ]);
    });
  });
});
