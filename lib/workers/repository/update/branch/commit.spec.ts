import { GlobalConfig } from '../../../../config/global';
import type { LongCommitSha } from '../../../../util/git/types';
import type { BranchConfig } from '../../../types';
import { commitFilesToBranch } from './commit';
import { scm } from '~test/util';

describe('workers/repository/update/branch/commit', () => {
  describe('commitFilesToBranch', () => {
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: 'disabled',
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedArtifacts: [],
        upgrades: [],
        platformCommit: 'auto',
        labels: ['label1', 'label2'],
      } satisfies BranchConfig;
      scm.commitAndPush.mockResolvedValueOnce('123test' as LongCommitSha);
      GlobalConfig.reset();
    });

    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it('commits files', async () => {
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls).toEqual([
        [
          {
            baseBranch: 'base-branch',
            branchName: 'renovate/some-branch',
            files: [
              {
                contents: 'some contents',
                path: 'package.json',
                type: 'addition',
              },
            ],
            force: false,
            message: 'some commit message',
            platformCommit: 'auto',
            labels: ['label1', 'label2'],
          },
        ],
      ]);
    });

    it('dry runs', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });
  });
});
