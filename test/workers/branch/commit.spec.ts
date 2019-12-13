import {
  commitFilesToBranch,
  CommitConfig,
} from '../../../lib/workers/branch/commit';
import { defaultConfig, platform } from '../../util';
import { RenovateConfig } from '../../../lib/config';

describe('workers/branch/automerge', () => {
  describe('commitFilesToBranch', () => {
    let config: RenovateConfig & CommitConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: false,
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedArtifacts: [],
      };
      jest.resetAllMocks();
      platform.commitFilesToBranch.mockResolvedValueOnce();
    });
    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('commits files', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(1);
      expect(platform.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
    it('dry runs', async () => {
      config.dryRun = true;
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
  });
});
