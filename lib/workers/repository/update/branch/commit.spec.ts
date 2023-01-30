import { getConfig, git } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import githubScm from '../../../../modules/platform/github/scm';
import { setPlatformScmApi } from '../../../../modules/platform/scm';
import type { BranchConfig } from '../../../types';
import { commitFilesToBranch } from './commit';

jest.mock('../../../../util/git');

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
      git.commitFiles.mockResolvedValueOnce('123test');
      setPlatformScmApi('default');
      GlobalConfig.reset();
    });

    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });

    it('commits files', async () => {
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls).toMatchSnapshot();
    });

    it('commits via github platform', async () => {
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      githubScm.commitAndPush = jest.fn();
      setPlatformScmApi('github');
      await commitFilesToBranch(config);
      expect(githubScm.commitAndPush).toHaveBeenCalledWith({
        baseBranch: undefined,
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
        platformCommit: false,
      });
    });

    it('dry runs', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
