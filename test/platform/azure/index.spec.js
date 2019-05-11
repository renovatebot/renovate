describe('platform/azure', () => {
  let azure;
  let azureApi;
  let azureHelper;
  let hostRules;
  let GitStorage;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/azure/azure-got-wrapper');
    jest.mock('../../../lib/platform/azure/azure-helper');
    jest.mock('../../../lib/platform/git/storage');
    hostRules = require('../../../lib/util/host-rules');
    azure = require('../../../lib/platform/azure');
    azureApi = require('../../../lib/platform/azure/azure-got-wrapper');
    azureHelper = require('../../../lib/platform/azure/azure-helper');
    GitStorage = require('../../../lib/platform/git/storage');
    GitStorage.mockImplementation(() => ({
      initRepo: jest.fn(),
      cleanRepo: jest.fn(),
      getFileList: jest.fn(),
      branchExists: jest.fn(() => true),
      isBranchStale: jest.fn(() => false),
      setBaseBranch: jest.fn(),
      getBranchLastCommitTime: jest.fn(),
      getAllRenovateBranches: jest.fn(),
      getCommitMessages: jest.fn(),
      getFile: jest.fn(),
      commitFilesToBranch: jest.fn(),
      mergeBranch: jest.fn(),
      deleteBranch: jest.fn(),
      getRepoStatus: jest.fn(),
    }));

    // clean up hostRules
    hostRules.clear();
    hostRules.update({
      platform: 'azure',
      endpoint: 'https://dev.azure.com/renovate12345',
      token: 'token',
    });
  });

  afterEach(() => {
    azure.cleanRepo();
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

  describe('getRepos()', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://dev.azure.com/renovate12345'
      );
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  describe('getRepoStatus()', () => {
    it('exists', async () => {
      await initRepo();
      expect(await azure.getRepoStatus()).toBeUndefined();
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
        endpoint: 'https://dev.azure.com/renovate12345',
      });
    }

    return azure.initRepo({
      endpoint: 'https://dev.azure.com/renovate12345',
      repository: 'some/repo',
      ...args[0],
    });
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo({
        repository: 'some-repo',
        token: 'token',
        endpoint: 'https://dev.azure.com/renovate12345',
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
  });
  describe('getPrList()', () => {
    it('returns empty array', () => {
      expect(azure.getPrList()).toEqual([]);
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
      expect(pr).toBeNull();
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
      expect(pr).toBeNull();
    });
    it('should return null if no PR is returned from azure', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => []),
      }));
      const pr = await azure.getPr(1234);
      expect(pr).toBeNull();
    });
    it('should return a pr in the right format', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        getPullRequests: jest.fn(() => [{ pullRequestId: 1234 }]),
        getPullRequestLabels: jest.fn(() => [
          { active: true, name: 'renovate' },
        ]),
      }));
      azureHelper.getRenovatePRFormat.mockImplementation(() => ({
        pullRequestId: 1234,
        labels: ['renovate'],
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
        createPullRequestLabel: jest.fn(() => ({})),
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
        createPullRequestLabel: jest.fn(() => ({})),
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
    it('should create and return a PR object with auto-complete set', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      const prResult = {
        pullRequestId: 456,
        displayNumber: `Pull Request #456`,
        createdBy: {
          id: 123,
        },
      };
      const prUpdateResult = {
        ...prResult,
        autoCompleteSetBy: {
          id: prResult.createdBy.id,
        },
        completionOptions: {
          squashMerge: true,
          deleteSourceBranch: true,
        },
      };
      const updateFn = jest
        .fn(() => prUpdateResult)
        .mockName('updatePullRequest');
      azureApi.gitApi.mockImplementationOnce(() => ({
        createPullRequest: jest.fn(() => prResult),
        createPullRequestLabel: jest.fn(() => ({})),
        updatePullRequest: updateFn,
      }));
      azureHelper.getRenovatePRFormat.mockImplementation(x => x);
      const pr = await azure.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate'],
        false,
        { azureAutoComplete: true }
      );
      expect(updateFn).toHaveBeenCalled();
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
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
    });
    it('nothing should happen, no number', async () => {
      await azure.ensureCommentRemoval();
      expect(azureApi.gitApi).toHaveBeenCalledTimes(0);
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
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
    });
  });

  describe('Assignees', () => {
    it('addAssignees', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementation(() => ({
        createThread: jest.fn(() => [{ id: 123 }]),
      }));
      await azure.addAssignees(123, ['test@bonjour.fr']);
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
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
        getTeams: jest.fn(() => [
          { id: 3, name: 'abc' },
          { id: 4, name: 'def' },
        ]),
        getTeamMembersWithExtendedProperties: jest.fn(() => [
          { identity: { displayName: 'jyc', uniqueName: 'jyc', id: 123 } },
        ]),
      }));
      await azure.addReviewers(123, ['test@bonjour.fr', 'jyc', 'def']);
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
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

    it('mergePr', async () => {
      const res = await azure.mergePr();
      expect(res).toBeUndefined();
    });

    // to become async?
    it('getPrFiles', () => {
      const res = azure.getPrFiles(46);
      expect(res).toHaveLength(0);
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await azure.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });

  describe('deleteLabel()', () => {
    it('Should delete a label', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      azureApi.gitApi.mockImplementationOnce(() => ({
        deletePullRequestLabels: jest.fn(),
      }));
      await azure.deleteLabel(1234, 'rebase');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });
});
