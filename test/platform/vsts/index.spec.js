const logger = require('../../_fixtures/logger');

describe('platform/vsts', () => {
  let vsts;
  let gitApi;
  let vstsHelper;
  beforeEach(() => {
    // clean up env
    delete process.env.VSTS_TOKEN;
    delete process.env.VSTS_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/vsts/vsts-got-wrapper');
    jest.mock('../../../lib/platform/vsts/vsts-helper');
    vsts = require('../../../lib/platform/vsts');
    gitApi = require('../../../lib/platform/vsts/vsts-got-wrapper');
    vstsHelper = require('../../../lib/platform/vsts/vsts-helper');
  });

  function getRepos(token, endpoint) {
    gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() =>
        [
          {
            name: 'a/b',
          },
          {
            name: 'c/d',
          },
        ]
      ),
    }));
    return vsts.getRepos(token, endpoint);
  }

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://fabrikam.VisualStudio.com/DefaultCollection'
      );
      expect(gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(...args) {
    gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() => (
        [
          {
            name: 'a/b',
            id: '1',
            privateRepo: true,
            isFork: false,
            defaultBranch: 'defBr',
          },
          {
            name: 'c/d',
          },
        ]
      ))
    }));
    gitApi.mockImplementationOnce(() => ({
      getBranch: jest.fn(() => (
        { commit: { commitId: '1234' } }
      )),
    }));

    return vsts.initRepo(...args);
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo(
        'some/repo',
        'token',
        'https://my.custom.endpoint/',
        logger
      );
      expect(gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
    });
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { commitId: '1234' }
        })),
      }));
      await vsts.setBaseBranch('some-branch');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commits messages', async () => {
      const config = await initRepo(
        'some/repo',
        'token',
        'https://my.custom.endpoint/',
        logger
      );
      expect(config.repoId).toBe('1');
      gitApi.mockImplementationOnce(() => ({
        getCommits: jest.fn(() => (
          [
            { comment: 'com1' },
            { comment: 'com2' },
            { comment: 'com3' },
          ]
        )),
      }));
      const msg = await vsts.getCommitMessages();
      expect(msg).toMatchSnapshot();
    });
  });

  describe('getFileContent(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getFile.mockImplementationOnce(() => `Hello Renovate!`);
      const content = await vsts.getFileContent('package.json');
      expect(content).toMatchSnapshot();
    });
  });

  describe('getFileJson(filePatch, branchName)', () => {
    it('should return the file contents parsed as JSON', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getFile.mockImplementationOnce(() => `{"content": "hello"}`);
      const content = await vsts.getFileJson('package.json');
      expect(content).toMatchSnapshot();
    });
    it('should return null if invalid JSON', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getFile.mockImplementationOnce(() => `{"content"= "hello"}`);// notice the = ^^
      const content = await vsts.getFileJson('package.json');
      expect(content).toBeNull();
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => (
          [
            {
              pullRequestId: 1,
              sourceRefName: 'refs/heads/branch-a',
              title: 'branch a pr',
              status: 2,
            },
          ]
        )),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(() => 'refs/heads/branch-a');
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => (
        {
          number: 1,
          head: { ref: 'branch-a' },
          title: 'branch a pr',
          state: 'open',
        }
      ));
      const res = await vsts.findPr('branch-a', 'branch a pr');
      expect(res).toBeDefined();
    });
  });

  describe('Not supported by VSTS (yet!)', () => {
    it('ensureCommentRemoval', async () => {
      const res = await vsts.ensureCommentRemoval();
      expect(res).toBeUndefined();
    });

    it('getAllRenovateBranches', async () => {
      const res = await vsts.getAllRenovateBranches();
      expect(res).toBeUndefined();
    });

    it('isBranchStale', async () => {
      const res = await vsts.isBranchStale();
      expect(res).toBeUndefined();
    });

    it('deleteBranch', async () => {
      const res = await vsts.deleteBranch();
      expect(res).toBeUndefined();
    });

    it('mergeBranch', async () => {
      const res = await vsts.mergeBranch();
      expect(res).toBeUndefined();
    });

    it('getBranchLastCommitTime', async () => {
      const res = await vsts.getBranchLastCommitTime();
      expect(res).toBeUndefined();
    });

    it('addAssignees', async () => {
      const res = await vsts.addAssignees();
      expect(res).toBeUndefined();
    });

    it('addReviewers', async () => {
      const res = await vsts.addReviewers();
      expect(res).toBeUndefined();
    });

    it('mergePr', async () => {
      const res = await vsts.mergePr();
      expect(res).toBeUndefined();
    });

    it('getSubDirectories', async () => {
      const res = await vsts.getSubDirectories();
      expect(res).toBeUndefined();
    });
  });
});
