const hostRules = require('../../../lib/util/host-rules');

describe('platform/azure', () => {
  let azure;
  let azureApi;
  let azureHelper;
  beforeEach(() => {
    // clean up hostRules
    hostRules.clear();

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/azure/azure-got-wrapper');
    jest.mock('../../../lib/platform/azure/azure-helper');
    azure = require('../../../lib/platform/azure');
    azureApi = require('../../../lib/platform/azure/azure-got-wrapper');
    azureHelper = require('../../../lib/platform/azure/azure-helper');
  });

  function getRepos(token, endpoint) {
    azureApi.gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() => [
        {
          name: 'repo1',
          project: {
            name: 'prj1',
          },
        },
        {
          name: 'repo2',
          project: {
            name: 'prj1',
          },
        },
      ]),
    }));
    return azure.getRepos(token, endpoint);
  }

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://fabrikam.VisualStudio.com/DefaultCollection'
      );
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });
  describe('getRepoStatus()', () => {
    it('exists', async () => {
      expect(await azure.getRepoStatus()).toEqual({});
    });
  });
  describe('cleanRepo()', () => {
    it('exists', () => {
      azure.cleanRepo();
    });
  });
  function initRepo(...args) {
    azureApi.gitApi.mockImplementationOnce(() => ({
      getRepositories: jest.fn(() => [
        {
          name: 'some-repo',
          id: '1',
          privateRepo: true,
          isFork: false,
          defaultBranch: 'defBr',
          project: {
            name: 'some-repo',
          },
        },
        {
          name: 'repo2',
          project: {
            name: 'prj2',
          },
        },
      ]),
    }));
    azureApi.gitApi.mockImplementationOnce(() => ({
      getBranch: jest.fn(() => ({ commit: { commitId: '1234' } })),
    }));
    azureHelper.getProjectAndRepo.mockImplementationOnce(() => ({
      project: 'some-repo',
      repo: 'some-repo',
    }));

    if (typeof args[0] === 'string') {
      return azure.initRepo({
        repository: args[0],
        token: args[1],
        endpoint: 'https://my.custom.endpoint/',
      });
    }

    return azure.initRepo({
      endpoint: 'https://my.custom.endpoint/',
      ...args[0],
    });
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo({
        repository: 'some-repo',
        token: 'token',
        endpoint: 'https://my.custom.endpoint/',
      });
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
    });
  });

  describe('getRepoForceRebase', () => {
    it('should return false', () => {
      expect(azure.getRepoForceRebase()).toBe(false);
    });
  });

  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo('some-repo', 'token');
      // getBranchCommit
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { commitId: '1234' },
        })),
      }));
      await azure.setBaseBranch('some-branch');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
    it('sets the base branch', async () => {
      await initRepo('some-repo', 'token');
      // getBranchCommit
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { commitId: '1234' },
        })),
      }));
      await azure.setBaseBranch();
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('getCommitMessages()', () => {
    it('returns commits messages', async () => {
      const config = await initRepo(
        'some-repo',
        'token',
        'https://my.custom.endpoint/'
      );
      expect(config.repoId).toBe('1');
      azureApi.gitApi.mockImplementationOnce(() => ({
        getCommits: jest.fn(() => [
          { comment: 'com1' },
          { comment: 'com2' },
          { comment: 'com3' },
        ]),
      }));
      const msg = await azure.getCommitMessages();
      expect(msg).toMatchSnapshot();
    });
    it('returns empty array if error', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const msgs = await azure.getCommitMessages();
      expect(msgs).toEqual([]);
    });
  });

  describe('getFile(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some-repo', 'token');
      azureHelper.getFile.mockImplementationOnce(() => `Hello Renovate!`);
      const content = await azure.getFile('package.json');
      expect(content).toMatchSnapshot();
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns pr if found it open', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'open',
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        state: 'open',
      }));
      const res = await azure.findPr('branch-a', 'branch a pr', 'open');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found not open', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        state: 'closed',
      }));
      const res = await azure.findPr('branch-a', 'branch a pr', '!open');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it close', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        state: 'closed',
      }));
      const res = await azure.findPr('branch-a', 'branch a pr', 'closed');
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it all state', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        state: 'closed',
      }));
      const res = await azure.findPr('branch-a', 'branch a pr');
      expect(res).toMatchSnapshot();
    });
    /*
    it('returns pr if found it but add an error', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(() => ({
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: true,
      }));
      const res = await azure.findPr('branch-a', 'branch a pr', 'blabla');
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const pr = await azure.findPr('branch-a', 'branch a pr');
      expect(pr).toBeNull();
    });
    */
  });
  describe('getPrList()', () => {
    it('returns empty array', () => {
      expect(azure.getPrList()).toEqual([]);
    });
  });
  describe('getFileList', () => {
    it('returns empty array if error', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const files = await azure.getFileList();
      expect(files).toEqual([]);
    });
    it('caches the result', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: '/symlinks/package.json' },
          { isFolder: false, path: '/package.json' },
          { isFolder: true, path: '/some-dir' },
          { type: 'blob', path: '/src/app/package.json' },
          { type: 'blob', path: '/src/otherapp/package.json' },
        ]),
      }));
      let files = await azure.getFileList();
      expect(files.length).toBe(4);
      files = await azure.getFileList();
      expect(files.length).toBe(4);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getItems: jest.fn(() => [
          { path: '/symlinks/package.json' },
          { isFolder: false, path: '/package.json' },
          { isFolder: true, path: '/some-dir' },
          { type: 'blob', path: '/src/app/package.json' },
          { type: 'blob', path: '/src/otherapp/package.json' },
        ]),
      }));
      const files = await azure.getFileList();
      expect(files).toMatchSnapshot();
    });
  });

  describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
    it('should add a new commit to the branch', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        createPush: jest.fn(() => true),
      }));
      azureHelper.getAzureBranchObj.mockImplementationOnce(() => 'newBranch');
      azureHelper.getRefs.mockImplementation(() => [{ objectId: '123' }]);

      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await azure.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
    it('should add a new commit to an existing branch', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        createPush: jest.fn(() => true),
      }));
      azureHelper.getAzureBranchObj.mockImplementationOnce(() => 'newBranch');
      azureHelper.getRefs.mockImplementation(() => []);

      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await azure.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('branchExists(branchName)', () => {
    it('should return false if the branch does not exist', async () => {
      await initRepo('some-repo', 'token');
      azureHelper.getRefs.mockImplementation(() => []);
      const exists = await azure.branchExists('thebranchname');
      expect(exists).toBe(false);
    });
  });

  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        findPr: jest.fn(() => false),
        getPr: jest.fn(() => {
          'myPRName';
        }),
      }));
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toBe(null);
    });
    it('should return the pr', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        getPullRequests: jest.fn(() => [
          {
            pullRequestId: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            status: 2,
          },
        ]),
      }));
      azureHelper.getNewBranchName.mockImplementation(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1,
        number: 1,
        head: { ref: 'branch-a' },
        title: 'branch a pr',
        isClosed: false,
      }));
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });

  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('return success if requiredStatusChecks null', async () => {
      await initRepo('some-repo', 'token');
      const res = await azure.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some-repo', 'token');
      const res = await azure.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('should pass through success', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 0 })),
      }));
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ aheadCount: 123 })),
      }));
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
  });

  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await azure.getPr(null);
      expect(pr).toBe(null);
    });
    it('should return null if no PR is returned from azure', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => []),
      }));
      const pr = await azure.getPr(1234);
      expect(pr).toBe(null);
    });
    it('should return a pr in the right format', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [{ pullRequestId: 1234 }]),
      }));
      azureHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1234,
      }));
      const pr = await azure.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
  });

  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => ({
          pullRequestId: 456,
          displayNumber: `Pull Request #456`,
        })),
      }));
      azureHelper.getRenovatePRFormat.mockImplementation(() => ({
        displayNumber: 'Pull Request #456',
        number: 456,
        pullRequestId: 456,
      }));
      const pr = await azure.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate']
      );
      expect(pr).toMatchSnapshot();
    });
    it('should create and return a PR object from base branch', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => ({
          pullRequestId: 456,
          displayNumber: `Pull Request #456`,
        })),
      }));
      azureHelper.getRenovatePRFormat.mockImplementation(() => ({
        displayNumber: 'Pull Request #456',
        number: 456,
        pullRequestId: 456,
      }));
      const pr = await azure.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate'],
        true
      );
      expect(pr).toMatchSnapshot();
    });
  });

  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        updatePullRequest: jest.fn(),
      }));
      await azure.updatePr(1234, 'The New Title', 'Hello world again');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });

    it('should update the PR without description', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        updatePullRequest: jest.fn(),
      }));
      await azure.updatePr(1234, 'The New Title - autoclose');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('ensureComment', () => {
    it('add comment', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        createThread: jest.fn(() => [{ id: 123 }]),
      }));
      await azure.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('isBranchStale', () => {
    it('should return true', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ commit: { commitId: '123456' } })),
      }));
      azureHelper.getCommitDetails.mockImplementation(() => ({
        parents: ['789654'],
      }));
      const res = await azure.isBranchStale();
      expect(res).toBe(true);
    });
    it('should return false', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({ commit: { commitId: '123457' } })),
      }));
      azureHelper.getCommitDetails.mockImplementation(() => ({
        parents: ['1234'],
      }));
      const res = await azure.isBranchStale('branch');
      expect(res).toBe(false);
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('should return all renovate branches', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranches: jest.fn(() => [
          { name: 'master' },
          { name: 'renovate/a' },
          { name: 'renovate/b' },
        ]),
      }));
      const res = await azure.getAllRenovateBranches('renovate/');
      expect(res).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        getThreads: jest.fn(() => [
          { comments: [{ content: '### some-subject\n\nblabla' }], id: 123 },
        ]),
        updateThread: jest.fn(),
      }));
      await azure.ensureCommentRemoval(42, 'some-subject');
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
    it('nothing should happen, no number', async () => {
      await azure.ensureCommentRemoval();
      expect(azureApi.gitApi.mock.calls.length).toBe(0);
    });
    it('comment not found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        getThreads: jest.fn(() => [
          { comments: [{ content: 'stupid comment' }], id: 123 },
        ]),
        updateThread: jest.fn(),
      }));
      await azure.ensureCommentRemoval(42, 'some-subject');
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('getBranchLastCommitTime', () => {
    it('should return a Date', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getBranch: jest.fn(() => ({
          commit: { committer: { date: '1986-11-07T00:00:00Z' } },
        })),
      }));
      const res = await azure.getBranchLastCommitTime('some-branch');
      expect(res).toMatchSnapshot();
    });
  });

  describe('deleteBranch and abandon PR', () => {
    it('should delete the branch', async () => {
      azureHelper.getRefs.mockImplementation(() => [{ objectId: '123' }]);
      azureApi.gitApi.mockImplementationOnce(() => ({
        updateRefs: jest.fn(() => [
          {
            name: 'refs/head/testBranch',
            oldObjectId: '123456',
            newObjectId: '0000000000000000000000000000000000000000',
          },
        ]),
      }));
      await azure.deleteBranch();
    });
  });

  describe('Assignees', () => {
    it('addAssignees', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        createThread: jest.fn(() => [{ id: 123 }]),
      }));
      await azure.addAssignees(123, ['test@bonjour.fr']);
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
  });

  describe('Reviewers', () => {
    it('addReviewers', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        getRepositories: jest.fn(() => [{ id: '1', project: { id: 2 } }]),
        createPullRequestReviewer: jest.fn(),
      }));
      azureApi.getCoreApi.mockImplementation(() => ({
        getTeams: jest.fn(() => [{ id: 3 }, { id: 4 }]),
        getTeamMembers: jest.fn(() => [
          { displayName: 'jyc', uniqueName: 'jyc', id: 123 },
        ]),
      }));
      await azure.addReviewers(123, ['test@bonjour.fr', 'jyc']);
      expect(azureApi.gitApi.mock.calls.length).toBe(3);
    });
  });
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      const input =
        '<details>https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(azure.getPrBody(input)).toMatchSnapshot();
    });
  });
  describe('Not supported by Azure DevOps (yet!)', () => {
    it('setBranchStatus', () => {
      const res = azure.setBranchStatus();
      expect(res).toBeUndefined();
    });

    it('mergeBranch', async () => {
      const res = await azure.mergeBranch();
      expect(res).toBeUndefined();
    });

    it('mergePr', async () => {
      const res = await azure.mergePr();
      expect(res).toBeUndefined();
    });

    // to become async?
    it('getPrFiles', () => {
      const res = azure.getPrFiles(46);
      expect(res.length).toBe(0);
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await azure.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
});
