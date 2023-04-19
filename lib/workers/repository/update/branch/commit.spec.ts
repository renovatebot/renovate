import { getConfig, scm } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { BranchConfig } from '../../../types';
import { commitFilesToBranch } from './commit';

describe('workers/repository/update/branch/commit', () => {
  describe('commitFilesToBranch', () => {
    let config: BranchConfig;

    beforeEach(() => {
      // TODO: incompatible types (#7154)
      config = {
        ...getConfig(),
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: 'disabled',
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedArtifacts: [],
        upgrades: [],
      } as BranchConfig;
      jest.resetAllMocks();
      scm.commitAndPush.mockResolvedValueOnce('123test');
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
      expect(scm.commitAndPush.mock.calls).toMatchSnapshot();
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
