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
      getRepositories: jest.fn(() => [
        {
          name: 'a/b',
        },
        {
          name: 'c/d',
        },
      ]),
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
      getRepositories: jest.fn(() => [
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
      ]),
    }));
    gitApi.mockImplementationOnce(() => ({
      getBranch: jest.fn(() => ({ commit: { commitId: '1234' } })),
    }));

    return vsts.initRepo(...args);
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo(
        'some/repo',
        'token',
        'https://my.custom.endpoint/'
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
          commit: { commitId: '1234' },
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
        'https://my.custom.endpoint/'
      );
      expect(config.repoId).toBe('1');
      gitApi.mockImplementationOnce(() => ({
        getCommits: jest.fn(() => [
          { comment: 'com1' },
          { comment: 'com2' },
          { comment: 'com3' },
        ]),
      }));
      const msg = await vsts.getCommitMessages();
      expect(msg).toMatchSnapshot();
    });
    it('returns empty array if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const msgs = await vsts.getCommitMessages();
      expect(msgs).toEqual([]);
    });
  });

  describe('getFile(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getFile.mockImplementationOnce(() => `Hello Renovate!`);
      const content = await vsts.getFile('package.json');
      expect(content).toMatchSnapshot();
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      vstsHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      vstsHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        state: 'open',
      }));
      const res = await vsts.findPr('branch-a', 'branch a pr');
      expect(res).toBeDefined();
    });
    it('returns null if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const pr = await vsts.findPr('branch-a', 'branch a pr');
      expect(pr).toBeNull();
    });
  });

  describe('getFileList', () => {
    it('returns empty array if error', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const files = await vsts.getFileList();
      expect(files).toEqual([]);
    });
    it('caches the result', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: 'symlinks/package.json' },
          { isFolder: false, path: 'package.json' },
          { isFolder: true, path: 'some-dir' },
          { type: 'blob', path: 'src/app/package.json' },
          { type: 'blob', path: 'src/otherapp/package.json' },
        ]),
      }));
      let files = await vsts.getFileList();
      expect(files.length).toBe(4);
      files = await vsts.getFileList();
      expect(files.length).toBe(4);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: 'symlinks/package.json' },
          { isFolder: false, path: 'package.json' },
          { isFolder: true, path: 'some-dir' },
          { type: 'blob', path: 'src/app/package.json' },
          { type: 'blob', path: 'src/otherapp/package.json' },
        ]),
      }));
      const files = await vsts.getFileList();
      expect(files).toMatchSnapshot();
    });
  });

  describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
    it('should add a new commit to the branch', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        branchExists: jest.fn(() => true),
        createPush: jest.fn(() => true),
      }));
      vstsHelper.getVSTSBranchObj.mockImplementationOnce(() => 'newBranch');
      vstsHelper.getRef.mockImplementation(() => [{ objectId: '123' }]);

      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await vsts.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('branchExists(branchName)', () => {
    it('should return false if the branch does not exist', async () => {
      await initRepo('some/repo', 'token');
      vstsHelper.getRef.mockImplementation(() => []);
      const exists = await vsts.branchExists('thebranchname');
      expect(exists).toBe(false);
    });
  });

  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        findPr: jest.fn(() => false),
        getPr: jest.fn(() => {
          'myPRName';
        }),
      }));
      const pr = await vsts.getBranchPr('somebranch');
      expect(pr).toBe(null);
    });
  });

  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('return success if requiredStatusChecks null', async () => {
      await initRepo('some/repo', 'token');
      const res = await vsts.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some/repo', 'token');
      const res = await vsts.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('should pass through success', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 0 })),
      }));
      const res = await vsts.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 123 })),
      }));
      const res = await vsts.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
  });

  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await vsts.getPr(null);
      expect(pr).toBe(null);
    });
    it('should return null if no PR is returned from vsts', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => []),
      }));
      const pr = await vsts.getPr(1234);
      expect(pr).toBe(null);
    });
    it('should return a pr in the right format', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [{ pullRequestId: 1234 }]),
      }));
      vstsHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1234,
      }));
      const pr = await vsts.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
  });

  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => ({
          pullRequestId: 456,
          displayNumber: `Pull Request #456`,
        })),
      }));
      const pr = await vsts.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate']
      );
      expect(pr).toMatchSnapshot();
    });
  });

  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementationOnce(() => ({
        updatePullRequest: jest.fn(),
      }));
      await vsts.updatePr(1234, 'The New Title', 'Hello world again');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('ensureComment', () => {
    it('add comment', async () => {
      await initRepo('some/repo', 'token');
      gitApi.mockImplementation(() => ({
        getThreads: jest.fn(() => [{ id: 123 }]),
        createComment: jest.fn(),
      }));
      await vsts.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('Not supported by VSTS (yet!)', () => {
    it('setBranchStatus', () => {
      const res = vsts.setBranchStatus();
      expect(res).toBeUndefined();
    });

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
  });
});
