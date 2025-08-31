import { dir } from 'tmp-promise';
import type { DirectoryResult } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import * as _exec from '../../../../util/exec';
import * as _gitAuth from '../../../../util/git/auth';
import type { StatusResult } from '../../../../util/git/types';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import * as postUpgradeCommands from './execute-post-upgrade-commands';
import { fs, git, logger, partial } from '~test/util';

vi.mock('../../../../util/exec');
vi.mock('../../../../util/fs');
vi.mock('../../../../util/git/auth');

const exec = vi.mocked(_exec);
const gitAuth = vi.mocked(_gitAuth);

describe('workers/repository/update/branch/execute-post-upgrade-commands', () => {
  describe('postUpgradeCommandsExecutor', () => {
    let tmpDir: DirectoryResult;

    beforeEach(async () => {
      GlobalConfig.reset();

      tmpDir = await dir({ unsafeCleanup: true });
    });

    afterEach(async () => {
      await tmpDir.cleanup();
    });

    it('handles an artifact which is a directory', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'update',
            commands: ['disallowed_command'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [],
        updatedArtifacts: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
          {
            type: 'addition',
            path: 'symlink',
            contents: 'dest',
            isSymlink: true,
          },
        ],
        artifactErrors: [],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(3);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });

    it('executes commands on update package files', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'update',
            commands: ['disallowed_command'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(0);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });

    it('creates data file for commands', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            commands: ['some-command'],
            dataFileTemplate:
              '[{{#each upgrades}}{"depName": "{{{depName}}}"}{{#unless @last}},{{/unless}}{{/each}}]',
            executionMode: 'update',
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        upgrades: [
          { manager: 'some-manager', branchName: 'main', depName: 'some-dep1' },
          { manager: 'some-manager', branchName: 'main', depName: 'some-dep2' },
        ],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      const cacheDir = upath.join(tmpDir.path, 'cache');
      GlobalConfig.set({
        localDir: upath.join(tmpDir.path, 'local'),
        cacheDir,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.privateCacheDir.mockReturnValue(cacheDir);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(0);
      expect(fs.outputCacheFile).toHaveBeenCalledTimes(1);
      expect(fs.outputCacheFile).toHaveBeenCalledWith(
        expect.stringMatching(
          `^.*${upath.sep}post-upgrade-data-file-[a-f0-9]{16}.tmp$`,
        ),
        '[{"depName": "some-dep1"},{"depName": "some-dep2"}]',
      );
    });

    it('should not create data file if no commands given', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'update',
            commands: [],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      const cacheDir = upath.join(tmpDir.path, 'cache');
      GlobalConfig.set({
        localDir: upath.join(tmpDir.path, 'local'),
        cacheDir,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.privateCacheDir.mockReturnValue(cacheDir);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(0);
      expect(fs.outputCacheFile).not.toHaveBeenCalled();
    });

    it('logs files which do not match fileFilters', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'branch',
            commands: ['command'],
            fileFilters: ['*.txt'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['not-a-txt-file'],
          not_added: [],
          deleted: [],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(0);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { file: 'not-a-txt-file' },
        'Post-upgrade file did not match any file filters',
      );
    });

    it('handles previously-deleted files which are re-added', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'branch',
            commands: ['command'],
            fileFilters: ['*.txt'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'unchanged.txt', contents: 'changed' },
          { type: 'deletion', path: 'was-deleted.txt' },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toHaveLength(0);
    });

    it('does not add back files that are renamed', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'branch',
            commands: ['command'],
            fileFilters: ['*.txt'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'bin/orc',
            contents: '[content]',
          },
        ],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'bin/orc',
            contents: '[content]',
          },
          {
            type: 'addition',
            path: 'bin/.orc-1.96.1.pkg',
            contents: '',
          },
          {
            type: 'deletion',
            path: 'bin/.orc-1.96.0.pkg',
          },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          not_added: [],
          conflicted: [],
          created: [],
          deleted: [],
          modified: ['bin/orc'],
          renamed: [
            {
              from: 'bin/.orc-1.96.0.pkg',
              to: 'bin/.orc-1.96.1.pkg',
            },
          ],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toMatchObject([
        {
          type: 'addition',
          path: 'bin/orc',
          contents: '[content]',
        },
        {
          type: 'addition',
          path: 'bin/.orc-1.96.1.pkg',
          contents: '',
        },
        {
          type: 'deletion',
          path: 'bin/.orc-1.96.0.pkg',
        },
      ]);
    });

    it('retains previously deleted files too', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'branch',
            commands: ['command'],
            fileFilters: ['*.txt'],
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'dependencies/Chart.yaml',
            contents: '[content]',
          },
        ],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'dependencies/Chart.lock',
            contents: '[content]',
          },
          {
            type: 'addition',
            path: 'dependencies/charts/ingress-nginx-4.12.2.tgz',
            contents: '[content]',
          },
          {
            type: 'deletion',
            path: 'dependencies/charts/ingress-nginx-4.12.0.tgz',
          },
        ],
        upgrades: [],
        branchName: 'main',
        baseBranch: 'base',
      };
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          not_added: ['dependencies/charts/ingress-nginx-4.12.2.tgz'],
          conflicted: [],
          created: [],
          deleted: ['dependencies/charts/ingress-nginx-4.12.0.tgz'],
          modified: [
            'dependencies/Chart.lock',
            'dependencies/Chart.yaml',
            'resources/helmfile.yaml',
          ],
        }),
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(res.updatedArtifacts).toMatchObject([
        {
          type: 'addition',
          path: 'dependencies/Chart.lock',
          contents: '[content]',
        },
        {
          type: 'addition',
          path: 'dependencies/charts/ingress-nginx-4.12.2.tgz',
          contents: '[content]',
        },
        {
          type: 'deletion',
          path: 'dependencies/charts/ingress-nginx-4.12.0.tgz',
        },
      ]);
    });

    it('passes git environment variables to exec', async () => {
      const commands = partial<BranchUpgradeConfig>([
        {
          manager: 'some-manager',
          branchName: 'main',
          postUpgradeTasks: {
            commands: ['some-command'],
            executionMode: 'update',
          },
        },
      ]);
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
        ],
        upgrades: [
          { manager: 'some-manager', branchName: 'main', depName: 'some-dep1' },
          { manager: 'some-manager', branchName: 'main', depName: 'some-dep2' },
        ],
        branchName: 'main',
        baseBranch: 'base',
      };
      const gitEnvVars = {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'url.https://token@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
      };
      gitAuth.getGitEnvironmentVariables.mockReturnValue(gitEnvVars);
      exec.exec.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      });
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
          not_added: [],
          deleted: [],
        }),
      );
      const localDir = upath.join(tmpDir.path, 'local');
      GlobalConfig.set({
        localDir,
        allowedCommands: ['some-command'],
      });
      fs.localPathIsFile.mockResolvedValueOnce(true);

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config,
      );

      expect(exec.exec).toHaveBeenCalledWith('some-command', {
        cwd: localDir,
        extraEnv: gitEnvVars,
      });
      expect(res.artifactErrors).toHaveLength(0);
    });
  });
});
