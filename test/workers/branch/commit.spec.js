const { commitFilesToBranch } = require('../../../lib/workers/branch/commit');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('workers/branch/automerge', () => {
  describe('commitFilesToBranch', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: false,
        semanticCommitType: 'a',
        semanticCommitScope: 'b',
        updatedPackageFiles: [],
        updatedLockFiles: [],
      };
      jest.resetAllMocks();
      platform.commitFilesToBranch.mockReturnValueOnce('created');
    });
    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('commits files', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(platform.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
    it('dry runs', async () => {
      config.dryRun = true;
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(0);
    });
  });
});
