import { mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import * as _fs from '../../util/fs';
import * as _git from '../../util/git';
import type { StatusResult } from '../../util/git/types';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import * as postUpgradeCommands from './execute-post-upgrade-commands';

jest.mock('../../util/fs');
jest.mock('../../util/git');

const fs = mocked(_fs);
const git = mocked(_git);

describe('workers/branch/execute-post-upgrade-commands', () => {
  describe('postUpgradeCommandsExecutor', () => {
    it('handles an artifact which is a directory', async () => {
      const commands: BranchUpgradeConfig[] = [
        {
          branchName: 'main',
          postUpgradeTasks: {
            executionMode: 'update',
            commands: ['disallowed_command'],
          },
        },
      ];
      const config: BranchConfig = {
        updatedPackageFiles: [],
        updatedArtifacts: [
          { name: __dirname + '/__fixtures__/sandbox', contents: '' },
          { name: __dirname + '/__fixtures__/artifact', contents: '' },
        ],
        artifactErrors: [],
        upgrades: [],
        branchName: 'main',
      };
      git.getRepoStatus.mockResolvedValueOnce({
        modified: [],
        not_added: [],
        deleted: [],
      } as StatusResult);
      GlobalConfig.set({ allowedPostUpgradeCommands: ['some-command'] });

      const res = await postUpgradeCommands.postUpgradeCommandsExecutor(
        commands,
        config
      );

      expect(res.updatedArtifacts).toHaveLength(2);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });
  });
});
