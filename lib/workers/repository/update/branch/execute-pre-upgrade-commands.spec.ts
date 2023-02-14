import { fs, git, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { StatusResult } from '../../../../util/git/types';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import * as preUpgradeCommands from './execute-pre-upgrade-commands';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe('workers/repository/update/branch/execute-pre-upgrade-commands', () => {
  describe('preUpgradeCommandsExecutor', () => {
    it('handles an artifact which is a directory', async () => {
      const commands: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          branchName: 'main',
          preUpgradeTasks: {
            executionMode: 'update',
            commands: ['disallowed_command'],
          },
        },
      ];
      const config: BranchConfig = {
        manager: 'some-manager',
        updatedPackageFiles: [],
        updatedArtifacts: [
          { type: 'addition', path: 'some-existing-dir', contents: '' },
          { type: 'addition', path: 'artifact', contents: '' },
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
        })
      );
      GlobalConfig.set({
        localDir: __dirname,
        allowedPreUpgradeCommands: ['some-command'],
      });
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = await preUpgradeCommands.preUpgradeCommandsExecutor(
        commands,
        config
      );

      expect(res.updatedArtifacts).toHaveLength(2);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });
  });
});
