describe('platform/gitlab', () => {
  let gitlab;
  let get;
  let hostRules;
  let GitStorage;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/gitlab/gl-got-wrapper');
    gitlab = require('../../../lib/platform/gitlab');
    get = require('../../../lib/platform/gitlab/gl-got-wrapper');
    jest.mock('../../../lib/util/host-rules');
    hostRules = require('../../../lib/util/host-rules');
    jest.mock('../../../lib/platform/git/storage');
    GitStorage = require('../../../lib/platform/git/storage').Storage;
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
      getBranchCommit: jest.fn(
        () => '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
      ),
    }));
    hostRules.find.mockReturnValue({
      token: 'abc123',
    });
  });

  afterEach(() => {
    gitlab.cleanRepo();
  });

  describe('initPlatform()', () => {
    it(`should throw if no token`, () => {
      expect(() => {
        gitlab.initPlatform({});
      }).toThrow();
    });
    it(`should default to gitlab.com`, () => {
      expect(gitlab.initPlatform({ token: 'some-token' })).toMatchSnapshot();
    });
    it(`should accept custom endpoint`, () => {
      expect(
        gitlab.initPlatform({
          endpoint: 'https://gitlab.renovatebot.com',
          token: 'some-token',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    function getRepos(...args) {
      // repo info
      get.mockImplementationOnce(() => ({
        body: [
          {
            path_with_namespace: 'a/b',
          },
          {
            path_with_namespace: 'c/d',
          },
        ],
      }));
      return gitlab.getRepos(...args);
    }
    it('should throw an error if it receives an error', async () => {
      get.mockImplementation(() => {
        throw new Error('getRepos error');
      });
      await expect(gitlab.getRepos()).rejects.toThrow(Error('getRepos error'));
    });
    it('should return an array of repos', async () => {
      const repos = await getRepos();
      expect(get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });
  describe('getRepoStatus()', () => {
    it('exists', async () => {
      await initRepo();
      await gitlab.getRepoStatus();
    });
  });
  describe('cleanRepo()', () => {
    it('exists', () => {
      gitlab.cleanRepo();
    });
  });
  function initRepo(...args) {
    // projects/${config.repository
    get.mockImplementationOnce(() => ({
      body: {
        default_branch: 'master',
      },
    }));
    // user
    get.mockImplementationOnce(() => ({
      body: {
        email: 'a@b.com',
      },
    }));
    get.mockReturnValue({
      body: [
        {
          number: 1,
          source_branch: 'branch-a',
          title: 'branch a pr',
          state: 'opened',
        },
      ],
    });
    if (args.length) {
      return gitlab.initRepo(...args);
    }
    return gitlab.initRepo({
      endpoint: 'https://gitlab.com',
      repository: 'some/repo',
      token: 'token',
    });
  }

  describe('initRepo', () => {
    it(`should escape all forward slashes in project names`, async () => {
      get.mockReturnValue({ body: [] });
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(get.mock.calls).toMatchSnapshot();
    });
    it('should throw an error if receiving an error', async () => {
      get.mockImplementation(() => {
        throw new Error('always error');
      });
      await expect(
        gitlab.initRepo({ repository: 'some/repo', token: 'sometoken' })
      ).rejects.toThrow(Error('always error'));
    });
    it('should throw an error if repository is archived', async () => {
      get.mockReturnValue({ body: { archived: true } });
      await expect(
        gitlab.initRepo({ repository: 'some/repo', token: 'sometoken' })
      ).rejects.toThrow(Error('archived'));
    });
    it('should throw an error if repository is empty', async () => {
      get.mockReturnValue({ body: { default_branch: null } });
      await expect(
        gitlab.initRepo({ repository: 'some/repo', token: 'sometoken' })
      ).rejects.toThrow(Error('empty'));
    });
  });
  describe('getRepoForceRebase', () => {
    it('should return false', () => {
      expect(gitlab.getRepoForceRebase()).toBe(false);
    });
  });
  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo();
      await gitlab.setBaseBranch('some-branch');
      expect(get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getFileList();
    });
  });
  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await gitlab.branchExists();
      });
    });
  });
  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getAllRenovateBranches();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getBranchLastCommitTime();
    });
  });
  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.isBranchStale();
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        // branchExists
        body: [],
      });
      const pr = await gitlab.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });
    it('should return the PR object', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [{ number: 91, source_branch: 'somebranch' }],
      });
      get.mockReturnValueOnce({
        body: {
          iid: 91,
          state: 'opened',
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          base: {
            sha: '1234',
          },
        },
      });
      get.mockReturnValueOnce({ body: [] }); // get branch commit
      get.mockReturnValueOnce({ body: [{ status: 'success' }] }); // get commit statuses
      get.mockReturnValueOnce({ body: 'foo' });
      const pr = await gitlab.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    beforeEach(() => {
      get.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      });
    });
    it('returns success if requiredStatusChecks null', async () => {
      const res = await gitlab.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      const res = await gitlab.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('returns pending if no results', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
    it('returns success if all are success', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'success' }],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('returns success if optional jobs fail', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
        ],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('returns failure if any mandatory jobs fails', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
          { status: 'failed' },
        ],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('failure');
    });
    it('returns custom statuses', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'foo' }],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('foo');
    });
    it('throws repository-changed', async () => {
      expect.assertions(1);
      GitStorage.mockImplementationOnce(() => ({
        initRepo: jest.fn(),
        branchExists: jest.fn(() => Promise.resolve(false)),
        cleanRepo: jest.fn(),
      }));
      await initRepo();
      await expect(gitlab.getBranchStatus('somebranch', true)).rejects.toThrow(
        'repository-changed'
      );
    });
  });
  describe('getBranchStatusCheck', () => {
    beforeEach(() => initRepo());
    it('returns null if no results', async () => {
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns null if no matching results', async () => {
      get.mockReturnValueOnce({
        body: [{ name: 'context-1', status: 'pending' }],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns status if name found', async () => {
      get.mockReturnValueOnce({
        body: [
          { name: 'context-1', state: 'pending' },
          { name: 'some-context', state: 'success' },
          { name: 'context-3', state: 'failed' },
        ],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual('success');
    });
  });
  describe('setBranchStatus', () => {
    it('sets branch status', async () => {
      await initRepo();
      await gitlab.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(get.post).toHaveBeenCalledTimes(1);
    });
  });
  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.mergeBranch('branch');
    });
  });
  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.deleteBranch('branch', true);
    });
  });
  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ],
      });
      const res = await gitlab.findIssue('title-3');
      expect(res).toBeNull();
    });
    it('finds issue', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { description: 'new-content' } });
      const res = await gitlab.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ],
      }));
      const res = await gitlab.ensureIssue('new-title', 'new-content');
      expect(res).toEqual('created');
    });
    it('updates issue', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { description: 'new-content' } });
      const res = await gitlab.ensureIssue('title-2', 'newer-content');
      expect(res).toEqual('updated');
    });
    it('skips update if unchanged', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            title: 'title-1',
          },
          {
            number: 2,
            title: 'title-2',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { description: 'newer-content' } });
      const res = await gitlab.ensureIssue('title-2', 'newer-content');
      expect(res).toBeNull();
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            number: 1,
            title: 'title-1',
          },
          {
            number: 2,
            title: 'title-2',
          },
        ],
      }));
      await gitlab.ensureIssueClosing('title-2');
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      get.mockReturnValueOnce({
        body: [{ id: 123 }],
      });
      await gitlab.addAssignees(42, ['someuser']);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('should warn if more than one assignee', async () => {
      get.mockReturnValueOnce({
        body: [{ id: 123 }],
      });
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('should swallow error', async () => {
      get.mockImplementationOnce({});
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.put).toHaveBeenCalledTimes(0);
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await gitlab.addReviewers(42, ['someuser', 'someotheruser']);
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({ body: [] });
      await gitlab.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(1);
      expect(get.post.mock.calls).toMatchSnapshot();
    });
    it('add updates comment if necessary', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      });
      await gitlab.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(0);
      expect(get.put).toHaveBeenCalledTimes(1);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
      });
      await gitlab.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(0);
      expect(get.put).toHaveBeenCalledTimes(0);
    });
    it('handles comment with no description', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({ body: [{ id: 1234, body: '!merge' }] });
      await gitlab.ensureComment(42, null, '!merge');
      expect(get.post).toHaveBeenCalledTimes(0);
      expect(get.put).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      });
      await gitlab.ensureCommentRemoval(42, 'some-subject');
      expect(get.delete).toHaveBeenCalledTimes(1);
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ],
      });
      const res = await gitlab.findPr('branch-a', null);
      expect(res).toBeDefined();
    });
    it('returns true if not open', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'merged',
          },
        ],
      });
      const res = await gitlab.findPr('branch-a', null, '!open');
      expect(res).toBeDefined();
    });
    it('caches pr list', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ],
      });
      let res = await gitlab.findPr('branch-a', null);
      expect(res).toBeDefined();
      res = await gitlab.findPr('branch-a', 'branch a pr');
      expect(res).toBeDefined();
      res = await gitlab.findPr('branch-a', 'branch a pr', 'open');
      expect(res).toBeDefined();
      res = await gitlab.findPr('branch-b');
      expect(res).not.toBeDefined();
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      get.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      });
      const pr = await gitlab.createPr(
        'some-branch',
        'some-title',
        'the-body',
        null
      );
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
    it('uses default branch', async () => {
      get.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      });
      const pr = await gitlab.createPr(
        'some-branch',
        'some-title',
        'the-body',
        [],
        true
      );
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'merged',
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
        },
      });
      get.mockReturnValueOnce({
        body: {
          commit: {},
        },
      });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the mergeable PR', async () => {
      await initRepo();
      get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'open',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
        },
      });
      get.mockReturnValueOnce({ body: [{ status: 'success' }] }); // get commit statuses
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the PR with nonexisting branch', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'open',
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 2,
          source_branch: 'some-branch',
        },
      }));
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getPrFiles()', () => {
    it('should return empty if no mrNo is passed', async () => {
      const prFiles = await gitlab.getPrFiles(null);
      expect(prFiles).toEqual([]);
    });
    it('returns files', async () => {
      get.mockReturnValueOnce({
        body: {
          changes: [
            { new_path: 'renovate.json' },
            { new_path: 'not renovate.json' },
          ],
        },
      });
      const prFiles = await gitlab.getPrFiles(123);
      expect(prFiles).toMatchSnapshot();
      expect(prFiles).toHaveLength(2);
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    jest.resetAllMocks();
    it('updates the PR', async () => {
      await gitlab.updatePr(1, 'title', 'body');
      expect(get.put.mock.calls.length).toEqual(1);
    });
  });
  describe('mergePr(pr)', () => {
    jest.resetAllMocks();
    it('merges the PR', async () => {
      await gitlab.mergePr({ number: 1 });
      expect(get.put.mock.calls.length).toEqual(1);
    });
  });
  const prBody = `https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5

  Pull Requests are the best, here are some PRs.

  ## Open

These updates have all been created already. Click a checkbox below to force a retry/rebase of any.

 - [ ] <!-- rebase-branch=renovate/major-got-packages -->[build(deps): update got packages (major)](../pull/2433) (\`gh-got\`, \`gl-got\`, \`got\`)
`;
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      expect(gitlab.getPrBody(prBody)).toMatchSnapshot();
    });
  });
  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getFile();
    });
  });
  describe('commitFilesToBranch()', () => {
    it('sends to gitFs', async () => {
      expect.assertions(1);
      await initRepo();
      await gitlab.commitFilesToBranch('some-branch', [{}]);
      expect(get.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getCommitMessages()', () => {
    it('passes to git', async () => {
      await initRepo();
      await gitlab.getCommitMessages();
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await gitlab.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'merged',
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          labels: ['foo', 'renovate', 'rebase'],
        },
      });
      get.mockReturnValueOnce({
        body: {
          commit: {},
        },
      });
      await gitlab.deleteLabel(42, 'rebase');
      expect(get.put.mock.calls).toMatchSnapshot();
    });
  });
});
