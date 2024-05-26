import { join } from 'upath';
import { mockExecAll } from '../../../../test/exec-util';
import { fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig, Upgrade } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/git');
jest.mock('../../../util/fs');

const config: UpdateArtifactsConfig = {
  copierOptions: {
    recopy: false,
    skipTasks: false,
    data: {},
    dataFile: '',
    skip: [],
    exclude: [],
  },
  allowScripts: false,
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
      }),
    );
  });

  afterEach(() => {
    GlobalConfig.reset();
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
      expect(execSnapshots).toMatchObject([]);
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
      expect(execSnapshots).toMatchObject([]);
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

    it('includes --trust when allowScripts is true', async () => {
      const execSnapshots = mockExecAll();

      const trustConfig = {
        ...config,
        allowScripts: true,
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

    it('handles data and list options correctly', async () => {
      const execSnapshots = mockExecAll();

      const optionsConfig = {
        ...config,
        copierOptions: {
          ...config.copierOptions,
          data: {
            variable1: 'value1',
            variable2: 'value2',
          },
          dataFile: 'foo/bar.yaml',
          skip: ['file1.txt', 'file2.txt'],
          exclude: ['*.tmp', 'backup/*'],
        },
      };

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: optionsConfig,
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: "copier update --skip-answered --defaults --data-file foo/bar.yaml --data variable1=value1 --data variable2=value2 --skip file1.txt --skip file2.txt --exclude '*.tmp' --exclude 'backup/*' --answers-file .copier-answers.yml --vcs-ref 1.1.0",
        },
      ]);
    });

    it('handles boolean options correctly', async () => {
      const execSnapshots = mockExecAll();

      const optionsConfig = {
        ...config,
        copierOptions: {
          skipTasks: true,
        },
      };

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: optionsConfig,
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'copier update --skip-answered --defaults --skip-tasks --answers-file .copier-answers.yml --vcs-ref 1.1.0',
        },
      ]);
    });

    it('does not allow a dataFile from outside the repository', async () => {
      const execSnapshots = mockExecAll();

      const optionsConfig = {
        ...config,
        copierOptions: {
          dataFile: '/foo/bar.yml',
        },
      };

      const result = await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: optionsConfig,
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: '.copier-answers.yml',
            stderr: 'copierOptions.dataFile is not part of the repository',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([]);
    });

    it('supports recopy instead of update', async () => {
      const execSnapshots = mockExecAll();

      const optionsConfig = {
        ...config,
        copierOptions: {
          recopy: true,
        },
      };

      await updateArtifacts({
        packageFileName: '.copier-answers.yml',
        updatedDeps: upgrades,
        newPackageFileContent: '',
        config: optionsConfig,
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'copier recopy --skip-answered --defaults --overwrite --answers-file .copier-answers.yml --vcs-ref 1.1.0',
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
        }),
      );

      fs.readLocalFile.mockResolvedValueOnce(
        '_src: https://github.com/foo/bar\n_commit: 1.1.0',
      );
      fs.readLocalFile.mockResolvedValueOnce('new file contents');

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
      expect(logger.warn).toHaveBeenCalledWith(
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
