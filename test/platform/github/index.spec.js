const fs = require('fs-extra');

describe('platform/github', () => {
  let github;
  let get;
  let hostRules;
  let GitStorage;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('delay');
    jest.mock('../../../lib/platform/github/gh-got-wrapper');
    jest.mock('../../../lib/util/host-rules');
    get = require('../../../lib/platform/github/gh-got-wrapper');
    github = require('../../../lib/platform/github');
    hostRules = require('../../../lib/util/host-rules');
    jest.mock('../../../lib/platform/git/storage');
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
      getBranchCommit: jest.fn(
        () => '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
      ),
    }));
    delete global.gitAuthor;
    hostRules.find.mockReturnValue({
      hostType: 'github',
      endpoint: 'https://api.github.com',
      token: 'abc123',
    });
  });

  const graphqlOpenPullRequests = fs.readFileSync(
    'test/platform/github/_fixtures/graphql/pullrequest-1.json',
    'utf8'
  );
  const graphqlClosedPullrequests = fs.readFileSync(
    'test/platform/github/_fixtures/graphql/pullrequests-closed.json',
    'utf8'
  );

  function getRepos(...args) {
    // repo info
    get.mockImplementationOnce(() => ({
      body: [
        {
          full_name: 'a/b',
        },
        {
          full_name: 'c/d',
        },
      ],
    }));
    return github.getRepos(...args);
  }

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(github.initPlatform({})).rejects.toThrow();
    });
    it('should throw if user failure', async () => {
      get.mockImplementationOnce(() => ({}));
      await expect(github.initPlatform({ token: 'abc123' })).rejects.toThrow();
    });
    it('should support default endpoint no email access', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          login: 'renovate-bot',
        },
      }));
      expect(await github.initPlatform({ token: 'abc123' })).toMatchSnapshot();
    });
    it('should support default endpoint no email result', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          login: 'renovate-bot',
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [{}],
      }));
      expect(await github.initPlatform({ token: 'abc123' })).toMatchSnapshot();
    });
    it('should support default endpoint with email', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          login: 'renovate-bot',
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            email: 'user@domain.com',
          },
        ],
      }));
      expect(await github.initPlatform({ token: 'abc123' })).toMatchSnapshot();
    });
    it('should support custom endpoint', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          login: 'renovate-bot',
        },
      }));
      expect(
        await github.initPlatform({
          endpoint: 'https://ghe.renovatebot.com',
          token: 'abc123',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos();
      expect(get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(...args) {
    // repo info
    get.mockImplementationOnce(() => ({
      body: {
        owner: {
          login: 'theowner',
        },
        default_branch: 'master',
        allow_rebase_merge: true,
        allow_squash_merge: true,
        allow_merge_commit: true,
      },
    }));
    if (args.length) {
      return github.initRepo(...args);
    }
    return github.initRepo({
      endpoint: 'https://github.com',
      repository: 'some/repo',
      token: 'token',
    });
  }

  describe('initRepo', () => {
    it('should rebase', async () => {
      function squashInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await squashInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should forks when forkMode', async () => {
      function forkInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getRepos
        get.mockImplementationOnce(() => ({
          body: [],
        }));
        // getBranchCommit
        get.post.mockImplementationOnce(() => ({
          body: {},
        }));
        return github.initRepo(...args);
      }
      const config = await forkInitRepo({
        repository: 'some/repo',
        forkMode: true,
      });
      expect(config).toMatchSnapshot();
    });
    it('should update fork when forkMode', async () => {
      function forkInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getRepos
        get.mockImplementationOnce(() => ({
          body: [
            {
              full_name: 'forked_repo',
            },
          ],
        }));
        // fork
        get.post.mockImplementationOnce(() => ({
          body: { full_name: 'forked_repo' },
        }));
        return github.initRepo(...args);
      }
      const config = await forkInitRepo({
        repository: 'some/repo',
        forkMode: true,
      });
      expect(config).toMatchSnapshot();
    });
    it('should squash', async () => {
      function mergeInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: false,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should merge', async () => {
      function mergeInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: false,
            allow_squash_merge: false,
            allow_merge_commit: true,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should not guess at merge', async () => {
      function mergeInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should throw error if archived', async () => {
      get.mockReturnValueOnce({
        body: {
          archived: true,
          owner: {},
        },
      });
      await expect(
        github.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow();
    });
    it('throws not-found', async () => {
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      await expect(
        github.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow('not-found');
    });
    it('should throw error if renamed', async () => {
      get.mockReturnValueOnce({
        body: {
          fork: true,
          full_name: 'some/other',
          owner: {},
        },
      });
      await expect(
        github.initRepo({
          includeForks: true,
          repository: 'some/repo',
        })
      ).rejects.toThrow('renamed');
    });
  });
  describe('getRepoForceRebase', () => {
    it('should detect repoForceRebase', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          required_pull_request_reviews: {
            dismiss_stale_reviews: false,
            require_code_owner_reviews: false,
          },
          required_status_checks: {
            strict: true,
            contexts: [],
          },
          restrictions: {
            users: [
              {
                login: 'rarkins',
                id: 6311784,
                type: 'User',
                site_admin: false,
              },
            ],
            teams: [],
          },
        },
      }));
      const res = await github.getRepoForceRebase();
      expect(res).toBe(true);
    });
    it('should handle 404', async () => {
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
    });
    it('should handle 403', async () => {
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 403,
        })
      );
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
    });
    it('should throw 401', async () => {
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      await expect(github.getRepoForceRebase()).rejects.toEqual({
        statusCode: 401,
      });
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });
    it('should return the PR object', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: [{ number: 91, head: { ref: 'somebranch' }, state: 'open' }],
      }));
      get.mockImplementationOnce(() => ({
        body: {
          number: 91,
          additions: 1,
          deletions: 1,
          commits: 1,
          base: {
            sha: '1234',
          },
          head: { ref: 'somebranch' },
          state: 'open',
        },
      }));
      get.mockResolvedValue({ body: { object: { sha: '12345' } } });
      const pr = await github.getBranchPr('somebranch');
      expect(get.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus()', () => {
    it('returns success if requiredStatusChecks null', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      const res = await github.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      const res = await github.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('should pass through success', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          state: 'success',
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          state: 'failed',
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('failed');
    });
    it('should fail if a check run has failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          state: 'pending',
          statuses: [],
        },
      }));
      get.mockImplementationOnce(() => ({
        body: {
          total_count: 2,
          check_runs: [
            {
              id: 23950198,
              status: 'completed',
              conclusion: 'success',
              name: 'Travis CI - Pull Request',
            },
            {
              id: 23950195,
              status: 'completed',
              conclusion: 'failed',
              name: 'Travis CI - Branch',
            },
          ],
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('failed');
    });
    it('should suceed if no status and all passed check runs', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          state: 'pending',
          statuses: [],
        },
      }));
      get.mockImplementationOnce(() => ({
        body: {
          total_count: 2,
          check_runs: [
            {
              id: 23950198,
              status: 'completed',
              conclusion: 'success',
              name: 'Travis CI - Pull Request',
            },
            {
              id: 23950195,
              status: 'completed',
              conclusion: 'success',
              name: 'Travis CI - Branch',
            },
          ],
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should fail if a check run has failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          state: 'pending',
          statuses: [],
        },
      }));
      get.mockImplementationOnce(() => ({
        body: {
          total_count: 2,
          check_runs: [
            {
              id: 23950198,
              status: 'completed',
              conclusion: 'success',
              name: 'Travis CI - Pull Request',
            },
            {
              id: 23950195,
              status: 'pending',
              name: 'Travis CI - Branch',
            },
          ],
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
  });
  describe('getBranchStatusCheck', () => {
    it('returns state if found', async () => {
      await initRepo({
        repository: 'some/repo',
        token: 'token',
      });
      get.mockImplementationOnce(() => ({
        body: [
          {
            context: 'context-1',
            state: 'state-1',
          },
          {
            context: 'context-2',
            state: 'state-2',
          },
          {
            context: 'context-3',
            state: 'state-3',
          },
        ],
      }));
      const res = await github.getBranchStatusCheck(
        'renovate/future_branch',
        'context-2'
      );
      expect(res).toEqual('state-2');
    });
    it('returns null', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: [
          {
            context: 'context-1',
            state: 'state-1',
          },
          {
            context: 'context-2',
            state: 'state-2',
          },
          {
            context: 'context-3',
            state: 'state-3',
          },
        ],
      }));
      const res = await github.getBranchStatusCheck('somebranch', 'context-4');
      expect(res).toBeNull();
    });
  });
  describe('setBranchStatus', () => {
    it('returns if already set', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: [
          {
            context: 'some-context',
            state: 'some-state',
          },
        ],
      }));
      await github.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(get.post).toHaveBeenCalledTimes(0);
    });
    it('sets branch status', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: [
          {
            context: 'context-1',
            state: 'state-1',
          },
          {
            context: 'context-2',
            state: 'state-2',
          },
          {
            context: 'context-3',
            state: 'state-3',
          },
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      await github.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(get.post).toHaveBeenCalledTimes(1);
    });
  });
  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
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
      const res = await github.findIssue('title-3');
      expect(res).toBeNull();
    });
    it('finds issue', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'open',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { body: 'new-content' } });
      const res = await github.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'open',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      }));
      const res = await github.ensureIssue('new-title', 'new-content');
      expect(res).toEqual('created');
    });
    it('creates issue if not ensuring only once', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'closed',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      }));
      const res = await github.ensureIssue('title-1', 'new-content');
      expect(res).toBeNull();
    });
    it('does not create issue if ensuring only once', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'closed',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      }));
      const once = true;
      const res = await github.ensureIssue('title-1', 'new-content', once);
      expect(res).toBeNull();
    });
    it('closes others if ensuring only once', async () => {
      get.mockImplementationOnce(() => ({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'closed',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
          {
            number: 3,
            title: 'title-1',
            state: 'open',
          },
        ],
      }));
      const once = true;
      const res = await github.ensureIssue('title-1', 'new-content', once);
      expect(res).toBeNull();
    });
    it('updates issue', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'open',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { body: 'new-content' } });
      const res = await github.ensureIssue('title-2', 'newer-content');
      expect(res).toEqual('updated');
    });
    it('skips update if unchanged', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'open',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { body: 'newer-content' } });
      const res = await github.ensureIssue('title-2', 'newer-content');
      expect(res).toBeNull();
    });
    it('deletes if duplicate', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            title: 'title-1',
            state: 'open',
          },
          {
            number: 2,
            title: 'title-1',
            state: 'open',
          },
        ],
      });
      get.mockReturnValueOnce({ body: { body: 'newer-content' } });
      const res = await github.ensureIssue('title-1', 'newer-content');
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
            state: 'open',
          },
          {
            number: 2,
            title: 'title-2',
            state: 'open',
          },
        ],
      }));
      await github.ensureIssueClosing('title-2');
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      await github.deleteLabel(42, 'rebase');
      expect(get.delete.mock.calls).toMatchSnapshot();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      await github.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.post.mockReturnValueOnce({});
      await github.addReviewers(42, ['someuser', 'someotheruser']);
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockReturnValueOnce({ body: [] });
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(2);
      expect(get.post.mock.calls[1]).toMatchSnapshot();
    });
    it('adds comment if found in closed PR list', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.post.mockImplementationOnce(() => ({
        body: graphqlClosedPullrequests,
      }));
      await github.ensureComment(2499, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(2);
      expect(get.patch).toHaveBeenCalledTimes(0);
    });
    it('add updates comment if necessary', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      });
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(1);
      expect(get.patch).toHaveBeenCalledTimes(1);
      expect(get.patch.mock.calls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
      });
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(get.post).toHaveBeenCalledTimes(1);
      expect(get.patch).toHaveBeenCalledTimes(0);
    });
    it('handles comment with no description', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.mockReturnValueOnce({ body: [{ id: 1234, body: '!merge' }] });
      await github.ensureComment(42, null, '!merge');
      expect(get.post).toHaveBeenCalledTimes(1);
      expect(get.patch).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      });
      await github.ensureCommentRemoval(42, 'some-subject');
      expect(get.delete).toHaveBeenCalledTimes(1);
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      });
      const res = await github.findPr('branch-a', null);
      expect(res).toBeDefined();
    });
    it('returns true if not open', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'closed',
          },
        ],
      });
      const res = await github.findPr('branch-a', null, '!open');
      expect(res).toBeDefined();
    });
    it('caches pr list', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      });
      let res = await github.findPr('branch-a', null);
      expect(res).toBeDefined();
      res = await github.findPr('branch-a', 'branch a pr');
      expect(res).toBeDefined();
      res = await github.findPr('branch-a', 'branch a pr', 'open');
      expect(res).toBeDefined();
      res = await github.findPr('branch-b');
      expect(res).not.toBeDefined();
    });
  });
  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.post.mockImplementationOnce(() => ({
        body: {
          number: 123,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      // res.body.object.sha
      get.mockImplementationOnce(() => ({
        body: {
          object: { sha: 'some-sha' },
        },
      }));
      const pr = await github.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        ['deps', 'renovate'],
        false,
        { statusCheckVerify: true }
      );
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
    it('should use defaultBranch', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.post.mockImplementationOnce(() => ({
        body: {
          number: 123,
        },
      }));
      const pr = await github.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        null,
        true
      );
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await github.getPr(null);
      expect(pr).toBeNull();
    });
    it('should return PR from graphql result', async () => {
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await initRepo({
        repository: 'some/repo',
      });
      get.post.mockImplementationOnce(() => ({
        body: graphqlOpenPullRequests,
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234123412341234123412341234123412341234',
          },
        },
      }));
      const pr = await github.getPr(2500);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
    });
    it('should return PR from closed graphql result', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      get.post.mockImplementationOnce(() => ({
        body: graphqlOpenPullRequests,
      }));
      get.post.mockImplementationOnce(() => ({
        body: graphqlClosedPullrequests,
      }));
      const pr = await github.getPr(2499);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
    });
    it('should return null if no PR is returned from GitHub', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockImplementationOnce(() => ({
        body: null,
      }));
      const pr = await github.getPr(1234);
      expect(pr).toBeNull();
    });
    [
      {
        number: 1,
        state: 'closed',
        base: { sha: '1234' },
        mergeable: true,
        merged_at: 'sometime',
      },
      {
        number: 1,
        state: 'open',
        mergeable_state: 'dirty',
        base: { sha: '1234' },
        commits: 1,
      },
      {
        number: 1,
        state: 'open',
        base: { sha: '5678' },
        commits: 1,
        mergeable: true,
      },
    ].forEach((body, i) => {
      it(`should return a PR object - ${i}`, async () => {
        await initRepo({ repository: 'some/repo', token: 'token' });
        get.mockImplementationOnce(() => ({
          body,
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        const pr = await github.getPr(1234);
        expect(pr).toMatchSnapshot();
      });
    });
    it('should return a rebaseable PR despite multiple commits', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 2,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            author: {
              login: 'foo',
            },
          },
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return an unrebaseable PR if multiple authors', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 2,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            commit: {
              author: {
                email: 'bar',
              },
            },
          },
          {
            committer: {
              login: 'web-flow',
            },
          },
          {},
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return a rebaseable PR if web-flow is second author', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      get.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 2,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            author: {
              login: 'foo',
            },
          },
          {
            committer: {
              login: 'web-flow',
            },
            commit: {
              message: "Merge branch 'master' into renovate/foo",
            },
            parents: [1, 2],
          },
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getPr(1234);
      expect(pr.canRebase).toBe(true);
      expect(pr).toMatchSnapshot();
    });
    it('should return a rebaseable PR if gitAuthor matches 1 commit', async () => {
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 1,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            commit: {
              author: {
                email: 'bot@renovateapp.com',
              },
            },
          },
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getPr(1234);
      expect(pr.canRebase).toBe(true);
      expect(pr).toMatchSnapshot();
    });
    it('should return a not rebaseable PR if gitAuthor does not match 1 commit', async () => {
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await initRepo({
        repository: 'some/repo',
      });
      get.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 1,
        },
      }));
      get.mockImplementationOnce(() => ({
        body: [
          {
            commit: {
              author: {
                email: 'foo@bar.com',
              },
            },
          },
        ],
      }));
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getPr(1234);
      expect(pr.canRebase).toBe(false);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getPrFiles()', () => {
    it('should return empty if no prNo is passed', async () => {
      const prFiles = await github.getPrFiles(null);
      expect(prFiles).toEqual([]);
    });
    it('returns files', async () => {
      get.mockReturnValueOnce({
        body: [
          { filename: 'renovate.json' },
          { filename: 'not renovate.json' },
        ],
      });
      const prFiles = await github.getPrFiles(123);
      expect(prFiles).toMatchSnapshot();
      expect(prFiles).toHaveLength(2);
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      await github.updatePr(1234, 'The New Title', 'Hello world again');
      expect(get.patch.mock.calls).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo)', () => {
    it('should merge the PR', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr)).toBe(true);
      expect(get.put).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
    });
    it('should handle merge error', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      get.put.mockImplementationOnce(() => {
        throw new Error('merge error');
      });
      expect(await github.mergePr(pr)).toBe(false);
      expect(get.put).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
    });
  });
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.getPrBody(input)).toMatchSnapshot();
    });
    it('returns not-updated pr body for GHE', async () => {
      get.mockImplementationOnce(() => ({
        body: {
          login: 'renovate-bot',
        },
      }));
      await github.initPlatform({
        endpoint: 'https://github.company.com',
        token: 'abc123',
      });
      hostRules.find.mockReturnValue({
        hostType: 'github',
        endpoint: 'https://github.company.com',
        token: 'abc123',
      });
      await initRepo({
        repository: 'some/repo',
      });
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.getPrBody(input)).toEqual(input);
    });
  });
  describe('mergePr(prNo) - autodetection', () => {
    beforeEach(async () => {
      function guessInitRepo(...args) {
        // repo info
        get.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1235',
            },
          },
        }));
        // getBranchCommit
        get.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1235',
            },
          },
        }));
        return github.initRepo(...args);
      }
      await guessInitRepo({ repository: 'some/repo', token: 'token' });
      get.put = jest.fn();
    });
    it('should try rebase first', async () => {
      const pr = {
        number: 1235,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr)).toBe(true);
      expect(get.put).toHaveBeenCalledTimes(1);
    });
    it('should try squash after rebase', async () => {
      const pr = {
        number: 1236,
        head: {
          ref: 'someref',
        },
      };
      get.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      await github.mergePr(pr);
      expect(get.put).toHaveBeenCalledTimes(2);
    });
    it('should try merge after squash', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      get.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      get.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      expect(await github.mergePr(pr)).toBe(true);
      expect(get.put).toHaveBeenCalledTimes(3);
    });
    it('should give up', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      get.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      get.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      get.put.mockImplementationOnce(() => {
        throw new Error('no merging allowed');
      });
      expect(await github.mergePr(pr)).toBe(false);
      expect(get.put).toHaveBeenCalledTimes(3);
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty if error', async () => {
      get.mockReturnValueOnce({
        body: {},
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
    it('returns array if found', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{\"vulnerabilityAlerts\":{\"edges\":[{\"node\":{\"externalIdentifier\":\"CVE-2018-1000136\",\"externalReference\":\"https://nvd.nist.gov/vuln/detail/CVE-2018-1000136\",\"affectedRange\":\">= 1.8, < 1.8.3\",\"fixedIn\":\"1.8.3\",\"id\":\"MDI4OlJlcG9zaXRvcnlWdWxuZXJhYmlsaXR5QWxlcnQ1MzE3NDk4MQ==\",\"packageName\":\"electron\"}}]}}}}";
      get.post.mockReturnValueOnce({
        body,
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(1);
    });
    it('returns empty if disabled', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{}}}";
      get.post.mockReturnValueOnce({
        body,
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
});
