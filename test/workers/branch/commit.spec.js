const { commitFilesToBranch } = require('../../../lib/workers/branch/commit');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

describe('workers/branch/automerge', () => {
  describe('commitFilesToBranch', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: { commitFilesToBranch: jest.fn() },
        logger,
        branchName: 'renovate/some-branch',
        commitMessage: 'some commit message',
        semanticCommits: false,
        semanticPrefix: 'some-prefix',
        updatedPackageFiles: [],
        updatedLockFiles: [],
      };
    });
    it('handles empty files', async () => {
      await commitFilesToBranch(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('commits files', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      await commitFilesToBranch(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
    it('applies semantic prefix', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      config.semanticCommits = true;
      await commitFilesToBranch(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
    it('lowercases only the first line when applying semantic prefix', async () => {
      config.updatedPackageFiles.push({
        name: 'package.json',
        contents: 'some contents',
      });
      config.commitMessage = 'Foo\n\nBar';
      config.semanticCommits = true;
      await commitFilesToBranch(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][2]).toEqual(
        'some-prefix foo\n\nBar'
      );
    });
  });
});
