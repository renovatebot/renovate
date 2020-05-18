import { defaultConfig, partial, platform } from '../../../test/util';
import { BranchConfig } from '../common';
import { commitFilesToBranch } from './commit';

describe('workers/branch/automerge', () => {
  describe('commitFilesToBranch', () => {
    let config: BranchConfig;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: false,
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedArtifacts: [],
      });
      jest.resetAllMocks();
      platform.commitFiles.mockResolvedValueOnce('abc123');
    });
    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(platform.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('commits files', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFiles).toHaveBeenCalledTimes(1);
      expect(platform.commitFiles.mock.calls).toMatchSnapshot();
    });
    it('dry runs', async () => {
      config.dryRun = true;
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
