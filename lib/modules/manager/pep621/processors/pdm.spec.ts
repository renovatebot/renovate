import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import * as hostRules from '../../../../util/host-rules';
import { getPkgReleases as _getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import { depTypes } from '../utils';
import { PdmProcessor } from './pdm';
import { mockExecAll } from '~test/exec-util';
import { fs } from '~test/util';

vi.mock('../../../../util/fs');
vi.mock('../../../datasource');

const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

const processor = new PdmProcessor();

describe('modules/manager/pep621/processors/pdm', () => {
  describe('updateArtifacts()', () => {
    it('return null if there is no lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
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
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // pdm
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
            'install-tool pdm v2.5.0 ' +
            '&& ' +
            'pdm update --no-sync --update-eager dep1' +
            '"',
        },
      ]);
    });

    it('returns artifact error', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
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
        { artifactError: { lockFile: 'pdm.lock', stderr: 'test error' } },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('return update dep update', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
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
          packageName: 'dep3',
          managerData: { depGroup: 'group1' },
          depType: depTypes.optionalDependencies,
        },
        {
          packageName: 'dep4',
          depType: depTypes.optionalDependencies,
          managerData: { depGroup: 'group1' },
        },
        {
          packageName: 'dep5',
          depType: depTypes.pdmDevDependencies,
          managerData: { depGroup: 'group2' },
        },
        {
          packageName: 'dep6',
          depType: depTypes.pdmDevDependencies,
          managerData: { depGroup: 'group2' },
        },
        {
          packageName: 'dep7',
          depType: depTypes.pdmDevDependencies,
          managerData: { depGroup: 'group3' },
        },
        {
          packageName: 'dep8',
          depType: depTypes.pdmDevDependencies,
          managerData: { depGroup: 'group3' },
        },
        { packageName: 'dep9', depType: depTypes.buildSystemRequires },
        {
          packageName: 'dep10',
          depType: depTypes.dependencyGroups,
          managerData: { depGroup: 'dev' },
        },
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
            path: 'pdm.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pdm update --no-sync --update-eager dep1 dep2',
        },
        {
          cmd: 'pdm update --no-sync --update-eager -G group1 dep3 dep4',
        },
        {
          cmd: 'pdm update --no-sync --update-eager -dG group2 dep5 dep6',
        },
        {
          cmd: 'pdm update --no-sync --update-eager -dG group3 dep7 dep8',
        },
        {
          cmd: 'pdm update --no-sync --update-eager -dG dev dep10',
        },
      ]);
    });

    it('discard dependencies if the devGroup is missing', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
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
          packageName: 'dep3',
          depType: depTypes.optionalDependencies,
        },
        {
          packageName: 'dep5',
          depType: depTypes.pdmDevDependencies,
        },
        {
          packageName: 'dep10',
          depType: depTypes.dependencyGroups,
        },
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
      expect(result).toBeNull();
      expect(execSnapshots).toEqual([]);
      expect(logger.once.warn).toHaveBeenCalledTimes(3);
    });

    it('return update on lockfileMaintenance', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
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

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'folder/pyproject.toml',
          newPackageFileContent: '',
          config: {
            isLockFileMaintenance: true,
          },
          updatedDeps: [],
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'pdm.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pdm update --no-sync --update-eager',
          options: {
            cwd: '/tmp/github/some/repo/folder',
          },
        },
      ]);
    });

    it('sets Git environment variables', async () => {
      hostRules.add({
        matchHost: 'https://example.com',
        username: 'user',
        password: 'pass',
      });
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
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

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'folder/pyproject.toml',
          newPackageFileContent: '',
          config: {
            isLockFileMaintenance: true,
          },
          updatedDeps: [],
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'pdm.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pdm update --no-sync --update-eager',
          options: {
            cwd: '/tmp/github/some/repo/folder',
            env: {
              GIT_CONFIG_COUNT: '3',
              GIT_CONFIG_KEY_0: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_KEY_1: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_KEY_2: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@example.com/',
              GIT_CONFIG_VALUE_1: 'git@example.com:',
              GIT_CONFIG_VALUE_2: 'https://example.com/',
            },
          },
        },
      ]);
    });
  });
});
