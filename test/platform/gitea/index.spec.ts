import * as _hostRules from '../../../lib/util/host-rules';

describe('platform/gitea', () => {
  let gitea: typeof import('../../../lib/platform/gitea');
  let api: jest.Mocked<
    typeof import('../../../lib/platform/gitea/gl-got-wrapper').api
  >;
  let hostRules: jest.Mocked<typeof _hostRules>;
  let GitStorage: jest.Mocked<
    typeof import('../../../lib/platform/git/storage')
  > &
    jest.Mock;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.resetAllMocks();
    jest.mock('../../../lib/platform/gitea/gl-got-wrapper');
    gitea = require('../../../lib/platform/gitea');
    api = require('../../../lib/platform/gitea/gl-got-wrapper').api;
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
    gitea.cleanRepo();
  });

  describe('initPlatform()', () => {
    it(`should throw if no token`, async () => {
      await expect(gitea.initPlatform({} as any)).rejects.toThrow();
    });
    it(`should throw if auth fails`, async () => {
      // user
      api.get.mockImplementationOnce(() => {
        throw new Error('401');
      });
      await expect(
        gitea.initPlatform({ token: 'some-token' } as any)
      ).rejects.toThrow();
    });
    it(`should default to gitea.com`, async () => {
      // user
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              email: 'a@b.com',
            },
          } as any)
      );
      expect(
        await gitea.initPlatform({ token: 'some-token' } as any)
      ).toMatchSnapshot();
      expect(api.get.mock.calls).toMatchSnapshot();
    });
    it(`should accept custom endpoint`, async () => {
      // user
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              email: 'a@b.com',
            },
          } as any)
      );
      expect(
        await gitea.initPlatform({
          endpoint: 'https://gitea.renovatebot.com',
          token: 'some-token',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    function getRepos() {
      // repo info
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              data: [
                {
                  full_name: 'a/b',
                },
                {
                  full_name: 'c/d',
                },
              ],
            },
          } as any)
      );
      return gitea.getRepos();
    }
    it('should throw an error if it receives an error', async () => {
      api.get.mockImplementation(() => {
        throw new Error('getRepos error');
      });
      await expect(gitea.getRepos()).rejects.toThrow(Error('getRepos error'));
    });
    it('should return an array of repos', async () => {
      const repos = await getRepos();
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });
  describe('getRepoStatus()', () => {
    it('exists', async () => {
      await initRepo();
      await gitea.getRepoStatus();
    });
  });
  describe('cleanRepo()', () => {
    it('exists', () => {
      gitea.cleanRepo();
    });
  });
  function initRepo(args?: any) {
    // projects/${config.repository}
    api.get.mockImplementationOnce(
      () =>
        ({
          body: {
            default_branch: 'master',
            http_url_to_repo: 'https://gitea.com/some/repo.git',
          },
        } as any)
    );
    // user
    api.get.mockImplementationOnce(
      () =>
        ({
          body: {
            email: 'a@b.com',
          },
        } as any)
    );
    if (args) {
      return gitea.initRepo(args);
    }
    return gitea.initRepo({
      repository: 'some/repo',
      localDir: '',
    });
  }

  describe('initRepo', () => {
    it(`should escape all forward slashes in project names`, async () => {
      api.get.mockReturnValue({ body: [] } as any);
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(api.get.mock.calls).toMatchSnapshot();
    });
    it('should throw an error if receiving an error', async () => {
      api.get.mockImplementation(() => {
        throw new Error('always error');
      });
      await expect(
        gitea.initRepo({ repository: 'some/repo', localDir: '' })
      ).rejects.toThrow(Error('always error'));
    });
    it('should throw an error if repository is archived', async () => {
      api.get.mockReturnValue({ body: { archived: true } } as any);
      await expect(
        gitea.initRepo({ repository: 'some/repo', localDir: '' })
      ).rejects.toThrow(Error('archived'));
    });
    it('should throw an error if repository is a mirror', async () => {
      api.get.mockReturnValue({ body: { mirror: true } } as any);
      await expect(
        gitea.initRepo({ repository: 'some/repo', localDir: '' })
      ).rejects.toThrow(Error('mirror'));
    });
    it('should throw an error if repository is empty', async () => {
      api.get.mockReturnValue({ body: { default_branch: null } } as any);
      await expect(
        gitea.initRepo({ repository: 'some/repo', localDir: '' })
      ).rejects.toThrow(Error('empty'));
    });
    it('should fall back if http_url_to_repo is empty', async () => {
      api.get.mockReturnValue({
        body: {
          default_branch: 'master',
          http_url_to_repo: null,
        },
      } as any);
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getRepoForceRebase', () => {
    it('should return false', () => {
      expect(gitea.getRepoForceRebase()).toBe(false);
    });
  });
  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo();
      await gitea.setBaseBranch('some-branch');
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.getFileList();
    });
  });
  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await gitea.branchExists('');
      });
    });
  });
  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.getAllRenovateBranches('');
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.getBranchLastCommitTime('');
    });
  });
  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.isBranchStale('');
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        // branchExists
        body: [],
      } as any);
      const pr = await gitea.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });
    it('should return the PR object', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [{ number: 91, source_branch: 'somebranch' }],
      } as any);
      api.get.mockReturnValueOnce({
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
      } as any);
      api.get.mockReturnValueOnce({ body: [] } as any); // get branch commit
      api.get.mockReturnValueOnce({ body: [{ status: 'success' }] } as any); // get commit statuses
      api.get.mockReturnValueOnce({ body: 'foo' } as any);
      const pr = await gitea.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    beforeEach(() => {
      api.get.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      } as any);
    });
    it('returns success if requiredStatusChecks null', async () => {
      const res = await gitea.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      const res = await gitea.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('returns pending if no results', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [],
      } as any);
      const res = await gitea.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
    it('returns success if all are success', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'success' }],
      } as any);
      const res = await gitea.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('returns success if optional jobs fail', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
        ],
      } as any);
      const res = await gitea.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('returns failure if any mandatory jobs fails', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
          { status: 'failed' },
        ],
      } as any);
      const res = await gitea.getBranchStatus('somebranch', []);
      expect(res).toEqual('failure');
    });
    it('returns custom statuses', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'foo' }],
      } as any);
      const res = await gitea.getBranchStatus('somebranch', []);
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
      await expect(gitea.getBranchStatus('somebranch', [])).rejects.toThrow(
        'repository-changed'
      );
    });
  });
  describe('getBranchStatusCheck', () => {
    beforeEach(() => initRepo());
    it('returns null if no results', async () => {
      api.get.mockReturnValueOnce({
        body: [],
      } as any);
      const res = await gitea.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns null if no matching results', async () => {
      api.get.mockReturnValueOnce({
        body: [{ name: 'context-1', status: 'pending' }],
      } as any);
      const res = await gitea.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns status if name found', async () => {
      api.get.mockReturnValueOnce({
        body: [
          { name: 'context-1', state: 'pending' },
          { name: 'some-context', state: 'success' },
          { name: 'context-3', state: 'failed' },
        ],
      } as any);
      const res = await gitea.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual('success');
    });
  });
  describe('setBranchStatus', () => {
    it('sets branch status', async () => {
      await initRepo();
      await gitea.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });
  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.mergeBranch('branch');
    });
  });
  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();

      api.get.mockResolvedValue({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ],
      } as any);
      await gitea.deleteBranch('branch', true);
    });
  });
  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
      api.get.mockReturnValueOnce({
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
      } as any);
      const res = await gitea.findIssue('title-3');
      expect(res).toBeNull();
    });
    it('finds issue', async () => {
      api.get.mockReturnValueOnce({
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
      } as any);
      api.get.mockReturnValueOnce({
        body: { description: 'new-content' },
      } as any);
      const res = await gitea.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      const res = await gitea.ensureIssue('new-title', 'new-content');
      expect(res).toEqual('created');
    });
    it('updates issue', async () => {
      api.get.mockReturnValueOnce({
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
      } as any);
      api.get.mockReturnValueOnce({
        body: { description: 'new-content' },
      } as any);
      const res = await gitea.ensureIssue('title-2', 'newer-content');
      expect(res).toEqual('updated');
    });
    it('skips update if unchanged', async () => {
      api.get.mockReturnValueOnce({
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
      } as any);
      api.get.mockReturnValueOnce({
        body: { description: 'newer-content' },
      } as any);
      const res = await gitea.ensureIssue('title-2', 'newer-content');
      expect(res).toBeNull();
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      await gitea.ensureIssueClosing('title-2');
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      api.get.mockReturnValueOnce({
        body: [{ id: 123 }],
      } as any);
      await gitea.addAssignees(42, ['someuser']);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('should warn if more than one assignee', async () => {
      api.get.mockReturnValueOnce({
        body: [{ id: 123 }],
      } as any);
      await gitea.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('should swallow error', async () => {
      api.get.mockImplementationOnce({} as any);
      await gitea.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await gitea.addReviewers(42, ['someuser', 'someotheruser']);
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockReturnValueOnce({ body: [] } as any);
      await gitea.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('add updates comment if necessary', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      } as any);
      await gitea.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
      } as any);
      await gitea.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
    it('handles comment with no description', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '!merge' }],
      } as any);
      await gitea.ensureComment(42, null, '!merge');
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      } as any);
      await gitea.ensureCommentRemoval(42, 'some-subject');
      expect(api.delete).toHaveBeenCalledTimes(1);
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      api.get.mockResolvedValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ],
      } as any);
      const res = await gitea.findPr('branch-a', null);
      expect(res).toBeDefined();
    });
    it('returns true if not open', async () => {
      api.get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'merged',
          },
        ],
      } as any);
      const res = await gitea.findPr('branch-a', null, '!open');
      expect(res).toBeDefined();
    });
    it('caches pr list', async () => {
      api.get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ],
      } as any);
      let res = await gitea.findPr('branch-a', null);
      expect(res).toBeDefined();
      res = await gitea.findPr('branch-a', 'branch a pr');
      expect(res).toBeDefined();
      res = await gitea.findPr('branch-a', 'branch a pr', 'open');
      expect(res).toBeDefined();
      res = await gitea.findPr('branch-b');
      expect(res).not.toBeDefined();
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      api.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      } as any);
      const pr = await gitea.createPr(
        'some-branch',
        'some-title',
        'the-body',
        null
      );
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('uses default branch', async () => {
      api.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      } as any);
      const pr = await gitea.createPr(
        'some-branch',
        'some-title',
        'the-body',
        [],
        true
      );
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      api.get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'merged',
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
        },
      } as any);
      api.get.mockReturnValueOnce({
        body: {
          commit: {},
        },
      } as any);
      const pr = await gitea.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the mergeable PR', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'open',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
        },
      } as any);
      api.get.mockReturnValueOnce({ body: [{ status: 'success' }] } as any); // get commit statuses
      api.get.mockReturnValueOnce({ body: { commit: null } } as any); // check last commit author
      const pr = await gitea.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the PR with nonexisting branch', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              id: 1,
              iid: 12345,
              description: 'a merge request',
              state: 'open',
              merge_status: 'cannot_be_merged',
              diverged_commits_count: 2,
              source_branch: 'some-branch',
            },
          } as any)
      );
      api.get.mockRejectedValueOnce({
        statusCode: 404,
      });
      const pr = await gitea.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getPrFiles()', () => {
    it('should return empty if no mrNo is passed', async () => {
      const prFiles = await gitea.getPrFiles(0);
      expect(prFiles).toEqual([]);
    });
    it('returns files', async () => {
      api.get.mockReturnValueOnce({
        body: {
          changes: [
            { new_path: 'renovate.json' },
            { new_path: 'not renovate.json' },
          ],
        },
      } as any);
      const prFiles = await gitea.getPrFiles(123);
      expect(prFiles).toMatchSnapshot();
      expect(prFiles).toHaveLength(2);
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    jest.resetAllMocks();
    it('updates the PR', async () => {
      await gitea.updatePr(1, 'title', 'body');
      expect(api.put.mock.calls.length).toEqual(1);
    });
  });
  describe('mergePr(pr)', () => {
    jest.resetAllMocks();
    it('merges the PR', async () => {
      await gitea.mergePr(1);
      expect(api.put.mock.calls.length).toEqual(1);
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
      expect(gitea.getPrBody(prBody)).toMatchSnapshot();
    });
  });
  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitea.getFile('');
    });
  });
  describe('commitFilesToBranch()', () => {
    it('sends to gitFs', async () => {
      expect.assertions(1);
      await initRepo();
      await gitea.commitFilesToBranch('some-branch', [{}], '');
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getCommitMessages()', () => {
    it('passes to git', async () => {
      await initRepo();
      await gitea.getCommitMessages();
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await gitea.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      api.get.mockReturnValueOnce({
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
      } as any);
      api.put.mockReturnValueOnce({
        body: {
          commit: {},
        },
      } as any);
      await gitea.deleteLabel(42, 'rebase');
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });
});
