import { defaultConfig, git, partial } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { BranchConfig } from '../types';
import { commitFilesToBranch } from './commit';

jest.mock('../../util/git');

describe('workers/branch/commit', () => {
  describe('commitFilesToBranch', () => {
    let config: BranchConfig;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: 'disabled',
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedArtifacts: [],
      });
      jest.resetAllMocks();
      git.commitFiles.mockResolvedValueOnce('123test');
      setGlobalConfig();
    });
    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
    it('commits files', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(1);
      expect(git.commitFiles.mock.calls).toMatchSnapshot();
    });
    it('dry runs', async () => {
      setGlobalConfig({ dryRun: true });
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(git.commitFiles).toHaveBeenCalledTimes(0);
    });
  });
});
