import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import * as hostRules from '../../../../util/host-rules.ts';
import { GitTagsDatasource } from '../../../datasource/git-tags/index.ts';
import { getPkgReleases as _getPkgReleases } from '../../../datasource/index.ts';
import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import type { UpdateArtifact, UpdateArtifactsConfig } from '../../types.ts';
import { parsePyProject } from '../extract.ts';
import type { Pep621ManagerData } from '../types.ts';
import { depTypes } from '../utils.ts';
import { PdmProcessor } from './pdm.ts';

vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../datasource/index.ts');

const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  binarySource: 'global',
};

const processor = new PdmProcessor();

describe('modules/manager/pep621/processors/pdm', () => {
  describe('updateArtifacts()', () => {
    it('throws TEMPORARY_ERROR', async () => {
      fs.readLocalFile.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));
      const result = processor.updateArtifacts(
        partial<UpdateArtifact<Pep621ManagerData>>({ config: {} }),
        partial(),
      );
      await expect(result).rejects.toThrow(TEMPORARY_ERROR);
    });

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
        parsePyProject('')!,
      );
      expect(result).toBeNull();
    });

    it('return null if the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
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
          config: { constraints: {} },
          updatedDeps,
        },
        parsePyProject('')!,
      );
      expect(result).toBeNull();
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
            '-e CI ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool python 3.11.2 ' +
            '&& ' +
            'install-tool pdm v2.5.0 ' +
            '&& ' +
            'pdm update --no-sync --update-eager dep1' +
            "'",
        },
      ]);
    });

    it('falls back to the extracted python constraint', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
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

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          // no `requires-python` in the pyproject, so the extracted one is used
          config: { extractedConstraints: { python: '==3.11.1' } },
          updatedDeps: [{ packageName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots.map(({ cmd }) => cmd).join('\n')).toContain(
        'install-tool python 3.11.1',
      );
    });

    it('falls back to the extracted pdm constraint', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: {}, extractedConstraints: { pdm: '2.6.1' } },
          updatedDeps: [{ packageName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toBeNull();
      expect(execSnapshots.map(({ cmd }) => cmd).join('\n')).toContain(
        'install-tool pdm 2.6.1',
      );
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
        parsePyProject('')!,
      );
      expect(result).toEqual([
        { artifactError: { fileName: 'pdm.lock', stderr: 'test error' } },
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
        parsePyProject('')!,
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
        parsePyProject('')!,
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
        parsePyProject('')!,
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

    describe('lock-file-only updates', () => {
      const privateCacheDir = upath.join('/tmp/cache/__renovate-private-cache');
      const overrideFile = expect.stringMatching(
        /^\/tmp\/cache\/__renovate-private-cache\/pdm-override-[0-9a-f-]+\.txt$/,
      );

      const updatedDeps = [
        {
          packageName: 'dep1',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          currentValue: '>=1.0.0',
          newValue: '>=1.0.0',
          newVersion: '1.2.0',
          isLockfileUpdate: true,
        },
        // pdm resolves a range update within the new range
        {
          packageName: 'dep2',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          currentValue: '>=1.0.0',
          newValue: '>=2.0.0',
          newVersion: '2.0.0',
        },
        {
          packageName: 'dep3',
          depType: depTypes.optionalDependencies,
          datasource: PypiDatasource.id,
          managerData: { depGroup: 'group1' },
          newVersion: '3.0.0',
          isLockfileUpdate: true,
        },
        // a git dependency has no version to pin
        {
          packageName: 'dep4',
          depType: depTypes.dependencies,
          datasource: GitTagsDatasource.id,
          newVersion: 'v4.0.0',
          isLockfileUpdate: true,
        },
        // no version was determined, so let pdm resolve it
        {
          packageName: 'dep5',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          isLockfileUpdate: true,
        },
      ];

      beforeEach(() => {
        GlobalConfig.set(adminConfig);
        fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
        fs.privateCacheDir.mockReturnValue(privateCacheDir);
        fs.readLocalFile.mockResolvedValueOnce('test content');
        fs.readLocalFile.mockResolvedValueOnce('changed test content');
      });

      it.each`
        constraint
        ${undefined}
        ${'2.17.0'}
        ${'>=2.17.0'}
      `(
        'pins the versions with an override file for pdm $constraint',
        async ({ constraint }: { constraint: string | undefined }) => {
          const execSnapshots = mockExecAll();

          const result = await processor.updateArtifacts(
            {
              packageFileName: 'pyproject.toml',
              newPackageFileContent: '',
              config: { constraints: { pdm: constraint } },
              updatedDeps,
            },
            parsePyProject('')!,
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
          expect(fs.outputCacheFile).toHaveBeenCalledExactlyOnceWith(
            overrideFile,
            'dep1==1.2.0\ndep3==3.0.0\n',
          );
          const [[path]] = fs.outputCacheFile.mock.calls;
          expect(execSnapshots).toMatchObject([
            {
              cmd: `pdm update --no-sync --update-eager --override ${path} dep1 dep2 dep4 dep5`,
            },
            {
              cmd: `pdm update --no-sync --update-eager --override ${path} -G group1 dep3`,
            },
          ]);
          expect(fs.rmCache).toHaveBeenCalledExactlyOnceWith(path);
        },
      );

      it('removes the override file when pdm fails', async () => {
        mockExecAll(new Error('pdm failed'));

        const result = await processor.updateArtifacts(
          {
            packageFileName: 'pyproject.toml',
            newPackageFileContent: '',
            config: {},
            updatedDeps,
          },
          parsePyProject('')!,
        );

        expect(result).toEqual([
          { artifactError: { fileName: 'pdm.lock', stderr: 'pdm failed' } },
        ]);
        const [[path]] = fs.outputCacheFile.mock.calls;
        expect(path).toEqual(overrideFile);
        expect(fs.rmCache).toHaveBeenCalledExactlyOnceWith(path);
      });

      it('writes no override file without a lock-file-only update', async () => {
        const execSnapshots = mockExecAll();

        await processor.updateArtifacts(
          {
            packageFileName: 'pyproject.toml',
            newPackageFileContent: '',
            config: {},
            updatedDeps: [updatedDeps[1]],
          },
          parsePyProject('')!,
        );

        expect(execSnapshots).toMatchObject([
          { cmd: 'pdm update --no-sync --update-eager dep2' },
        ]);
        expect(fs.outputCacheFile).not.toHaveBeenCalled();
        expect(fs.rmCache).not.toHaveBeenCalled();
      });

      it('does not pin a dep which the lock file holds at several versions', async () => {
        const execSnapshots = mockExecAll();

        await processor.updateArtifacts(
          {
            packageFileName: 'pyproject.toml',
            newPackageFileContent: '',
            config: {},
            updatedDeps: [
              updatedDeps[0],
              {
                packageName: 'numpy',
                depType: depTypes.dependencies,
                datasource: PypiDatasource.id,
                newVersion: '2.2.6',
                isLockfileUpdate: true,
                managerData: { hasMultipleLockedEntries: true },
              },
            ],
          },
          parsePyProject('')!,
        );

        expect(fs.outputCacheFile).toHaveBeenCalledExactlyOnceWith(
          overrideFile,
          'dep1==1.2.0\n',
        );
        const [[path]] = fs.outputCacheFile.mock.calls;
        expect(execSnapshots).toMatchObject([
          {
            cmd: `pdm update --no-sync --update-eager --override ${path} dep1 numpy`,
          },
        ]);
      });

      it.each`
        constraint
        ${'2.16.1'}
        ${'<2.17'}
        ${'>=2.10.0'}
        ${'>=2.17,<3'}
      `(
        'does not pin the versions for pdm $constraint',
        async ({ constraint }: { constraint: string }) => {
          const execSnapshots = mockExecAll();

          await processor.updateArtifacts(
            {
              packageFileName: 'pyproject.toml',
              newPackageFileContent: '',
              config: { constraints: { pdm: constraint } },
              updatedDeps,
            },
            parsePyProject('')!,
          );

          expect(execSnapshots).toMatchObject([
            { cmd: 'pdm update --no-sync --update-eager dep1 dep2 dep4 dep5' },
            { cmd: 'pdm update --no-sync --update-eager -G group1 dep3' },
          ]);
          expect(fs.outputCacheFile).not.toHaveBeenCalled();
          expect(fs.rmCache).not.toHaveBeenCalled();
          expect(logger.debug).toHaveBeenCalledWith(
            { constraint },
            expect.stringContaining('updating without pinning versions'),
          );
        },
      );
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
        parsePyProject('')!,
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
