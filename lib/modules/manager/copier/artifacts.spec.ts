import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { mockExecAll } from '../../../../test/exec-util';
import { fs, git, mocked, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig, Upgrade } from '../types';
import { updateArtifacts } from '.';

const datasource = mocked(_datasource);

jest.mock('../../../util/git');
jest.mock('../../../util/fs');
jest.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {
  ignoreScripts: true,
};

const upgrades: Upgrade[] = [
  {
    depName: 'https://github.com/foo/bar',
    currentValue: '1.0.0',
    newValue: '1.1.0',
  },
];

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
  allowScripts: false,
};

describe('modules/manager/copier/artifacts', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);

    // Mock git repo status
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        conflicted: [],
        modified: ['.copier-answers.yml'],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );
  });

  afterEach(() => {
    fs.readLocalFile.mockClear();
    git.getRepoStatus.mockClear();
  });

  describe('updateArtifacts()', () => {
    it('returns null if newVersion is not provided', async () => {
      const execSnapshots = mockExecAll();

      const invalidUpgrade = [
        { ...upgrades[0], newValue: undefined, newVersion: undefined },
      ];

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: invalidUpgrade,
        newPackageFileContent: '',
        config,
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: '.copier-answers.yml',
            stderr: 'Missing copier template version to update to',
          },
        },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('reports an error if no upgrade is specified', async () => {
      const execSnapshots = mockExecAll();

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: '.copier-answers.yml',
            stderr: 'Unexpected number of dependencies: 0 (should be 1)',
          },
        },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('invokes copier update with the correct options by default', async () => {
      const execSnapshots = mockExecAll();

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: {},
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'copier update --skip-answered --defaults --answers-file .copier-answers.yml --vcs-ref 1.1.0',
        },
      ]);
    });

    it.each`
      pythonConstraint | copierConstraint
      ${null}          | ${null}
      ${'3.11.3'}      | ${null}
      ${null}          | ${'9.1.0'}
      ${'3.11.3'}      | ${'9.1.0'}
    `(
      `supports dynamic install with constraints python=$pythonConstraint copier=$copierConstraint`,
      async ({ pythonConstraint, copierConstraint }) => {
        GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
        const constraintConfig = {
          python: pythonConstraint ?? '',
          copier: copierConstraint ?? '',
        };
        if (!pythonConstraint) {
          datasource.getPkgReleases.mockResolvedValueOnce({
            releases: [{ version: '3.12.4' }],
          });
        }
        if (!copierConstraint) {
          datasource.getPkgReleases.mockResolvedValueOnce({
            releases: [{ version: '9.2.0' }],
          });
        }
        const execSnapshots = mockExecAll();

        expect(
          await updateArtifacts({
            packageFileName: '.copier-answers.yml',
            updatedDeps: upgrades,
            newPackageFileContent: '',
            config: {
              ...config,
              constraints: constraintConfig,
            },
          }),
        ).not.toBeNull();

        expect(execSnapshots).toMatchObject([
          { cmd: `install-tool python ${pythonConstraint ?? '3.12.4'}` },
          { cmd: `install-tool copier ${copierConstraint ?? '9.2.0'}` },
          {
            cmd: 'copier update --skip-answered --defaults --answers-file .copier-answers.yml --vcs-ref 1.1.0',
          },
        ]);
      },
    );

    it('includes --trust when allowScripts is true and ignoreScripts is false', async () => {
      GlobalConfig.set({ ...adminConfig, allowScripts: true });
      const execSnapshots = mockExecAll();

      const trustConfig = {
        ...config,
        ignoreScripts: false,
      };

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: trustConfig,
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'copier update --skip-answered --defaults --trust --answers-file .copier-answers.yml --vcs-ref 1.1.0',
        },
      ]);
    });

    it('does not include --trust when ignoreScripts is true', async () => {
      GlobalConfig.set({ ...adminConfig, allowScripts: true });
      const execSnapshots = mockExecAll();

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config,
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'copier update --skip-answered --defaults --answers-file .copier-answers.yml --vcs-ref 1.1.0',
        },
      ]);
    });

    it('handles exec errors', async () => {
      mockExecAll(new Error('exec exception'));
      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config,
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: '.copier-answers.yml',
            stderr: 'exec exception',
          },
        },
      ]);
    });

    it('does not report changes if answers-file was not changed', async () => {
      mockExecAll();

      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          conflicted: [],
          modified: [],
          not_added: ['new_file.py'],
          deleted: ['old_file.py'],
          renamed: [],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config,
      });

      expect(result).toBeNull();
    });

    it('returns updated artifacts if repo status has changes', async () => {
      mockExecAll();

      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          conflicted: [],
          modified: ['.copier-answers.yml'],
          not_added: ['new_file.py'],
          deleted: ['old_file.py'],
          renamed: [{ from: 'renamed_old.py', to: 'renamed_new.py' }],
        }),
      );

      fs.readLocalFile.mockResolvedValueOnce(
        '_src: https://github.com/foo/bar\n_commit: 1.1.0',
      );
      fs.readLocalFile.mockResolvedValueOnce('new file contents');
      fs.readLocalFile.mockResolvedValueOnce('renamed file contents');

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config,
      });

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: '.copier-answers.yml',
            contents: '_src: https://github.com/foo/bar\n_commit: 1.1.0',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'new_file.py',
            contents: 'new file contents',
          },
        },
        {
          file: {
            type: 'deletion',
            path: 'old_file.py',
          },
        },
        {
          file: {
            type: 'deletion',
            path: 'renamed_old.py',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'renamed_new.py',
            contents: 'renamed file contents',
          },
        },
      ]);
    });

    it('warns about, but adds conflicts', async () => {
      mockExecAll();

      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          conflicted: ['conflict_file.py'],
          modified: ['.copier-answers.yml'],
          not_added: ['new_file.py'],
          deleted: ['old_file.py'],
          renamed: [],
        }),
      );

      fs.readLocalFile.mockResolvedValueOnce(
        '_src: https://github.com/foo/bar\n_commit: 1.1.0',
      );
      fs.readLocalFile.mockResolvedValueOnce('new file contents');
      fs.readLocalFile.mockResolvedValueOnce('conflict file contents');

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          depName: 'https://github.com/foo/bar',
          packageFileName: '.copier-answers.yml',
        },
        'Updating the Copier template yielded 1 merge conflicts. Please check the proposed changes carefully! Conflicting files:\n  * conflict_file.py',
      );
      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: '.copier-answers.yml',
            contents: '_src: https://github.com/foo/bar\n_commit: 1.1.0',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'new_file.py',
            contents: 'new file contents',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'conflict_file.py',
            contents: 'conflict file contents',
          },
          notice: {
            file: 'conflict_file.py',
            message:
              'This file had merge conflicts. Please check the proposed changes carefully!',
          },
        },
        {
          file: {
            type: 'deletion',
            path: 'old_file.py',
          },
        },
      ]);
    });
  });
});
