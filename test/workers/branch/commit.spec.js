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
    it('applies semantic prefix', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      config.semanticCommits = true;
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(platform.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
    it('lowercases only the first line when applying semantic prefix', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      config.commitMessage = 'Foo\n\nBar';
      config.semanticCommits = true;
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(platform.commitFilesToBranch.mock.calls[0][2]).toEqual(
        'a(b): foo\n\nBar'
      );
    });
    it('adds commit message body', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      config.commitBody = '[skip-ci]';
      await commitFilesToBranch(config);
      expect(platform.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(platform.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
  });
});
