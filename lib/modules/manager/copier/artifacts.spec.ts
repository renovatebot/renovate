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
