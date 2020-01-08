import fs from 'fs-extra';
import { GotApi, GotResponse } from '../../../lib/platform/common';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
} from '../../../lib/constants/error-messages';

describe('platform/github', () => {
  let github: typeof import('../../../lib/platform/github');
  let api: jest.Mocked<GotApi>;
  let got: jest.Mock<Promise<Partial<GotResponse>>>;
  let hostRules: jest.Mocked<typeof import('../../../lib/util/host-rules')>;
  let GitStorage: jest.Mock<typeof import('../../../lib/platform/git/storage')>;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.unmock('../../../lib/platform');
    jest.mock('delay');
    jest.mock('../../../lib/platform/github/gh-got-wrapper');
    jest.mock('../../../lib/util/host-rules');
    jest.mock('../../../lib/util/got');
    api = (await import('../../../lib/platform/github/gh-got-wrapper'))
      .api as any;
    got = (await import('../../../lib/util/got')).default as any;
    github = await import('../../../lib/platform/github');
    hostRules = (await import('../../../lib/util/host-rules')) as any;
    jest.mock('../../../lib/platform/git/storage');
    GitStorage = (await import('../../../lib/platform/git/storage'))
      .Storage as any;
    GitStorage.mockImplementation(
      () =>
        ({
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
        } as any)
    );
    delete global.gitAuthor;
    hostRules.find.mockReturnValue({
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

  function getRepos() {
    // repo info
    api.get.mockImplementationOnce(
      () =>
        ({
          body: [
            {
              full_name: 'a/b',
            },
            {
              full_name: 'c/d',
            },
          ],
        } as any)
    );
    return github.getRepos();
  }

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(github.initPlatform({} as any)).rejects.toThrow();
    });
    it('should throw if user failure', async () => {
      api.get.mockImplementationOnce(() => ({} as any));
      await expect(
        github.initPlatform({ token: 'abc123' } as any)
      ).rejects.toThrow();
    });
    it('should support default endpoint no email access', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              login: 'renovate-bot',
            },
          } as any)
      );
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
    });
    it('should support default endpoint no email result', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              login: 'renovate-bot',
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [{}],
          } as any)
      );
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
    });
    it('should support default endpoint with email', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              login: 'renovate-bot',
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [
              {
                email: 'user@domain.com',
              },
            ],
          } as any)
      );
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
    });
    it('should support custom endpoint', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              login: 'renovate-bot',
            },
          } as any)
      );
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
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(args: { repository: string; token?: string }) {
    // repo info
    api.get.mockImplementationOnce(
      () =>
        ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        } as any)
    );
    if (args) {
      return github.initRepo(args as any);
    }
    return github.initRepo({
      endpoint: 'https://github.com',
      repository: 'some/repo',
    } as any);
  }

  describe('initRepo', () => {
    it('should throw err if disabled in renovate.json', async () => {
      // repo info
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              owner: {
                login: 'theowner',
              },
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              content: Buffer.from('{"enabled": false}').toString('base64'),
            },
          } as any)
      );
      await expect(
        github.initRepo({
          repository: 'some/repo',
          optimizeForDisabled: true,
        } as any)
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
    it('should rebase', async () => {
      function squashInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
                allow_rebase_merge: true,
                allow_squash_merge: true,
                allow_merge_commit: true,
              },
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await squashInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should forks when forkMode', async () => {
      function forkInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
                allow_rebase_merge: true,
                allow_squash_merge: true,
                allow_merge_commit: true,
              },
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1234',
                },
              },
            } as any)
        );
        // api.getRepos
        api.get.mockImplementationOnce(
          () =>
            ({
              body: [],
            } as any)
        );
        // api.getBranchCommit
        api.post.mockImplementationOnce(
          () =>
            ({
              body: {},
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await forkInitRepo({
        repository: 'some/repo',
        forkMode: true,
      });
      expect(config).toMatchSnapshot();
    });
    it('should update fork when forkMode', async () => {
      function forkInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
                allow_rebase_merge: true,
                allow_squash_merge: true,
                allow_merge_commit: true,
              },
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1234',
                },
              },
            } as any)
        );
        // api.getRepos
        api.get.mockImplementationOnce(
          () =>
            ({
              body: [
                {
                  full_name: 'forked_repo',
                },
              ],
            } as any)
        );
        // fork
        api.post.mockImplementationOnce(
          () =>
            ({
              body: { full_name: 'forked_repo' },
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await forkInitRepo({
        repository: 'some/repo',
        forkMode: true,
      });
      expect(config).toMatchSnapshot();
    });
    it('should squash', async () => {
      function mergeInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
                allow_rebase_merge: false,
                allow_squash_merge: true,
                allow_merge_commit: true,
              },
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should merge', async () => {
      function mergeInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
                allow_rebase_merge: false,
                allow_squash_merge: false,
                allow_merge_commit: true,
              },
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should not guess at merge', async () => {
      function mergeInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
              },
            } as any)
        );
        return github.initRepo(args);
      }
      const config = await mergeInitRepo({
        repository: 'some/repo',
      });
      expect(config).toMatchSnapshot();
    });
    it('should throw error if archived', async () => {
      api.get.mockReturnValueOnce({
        body: {
          archived: true,
          owner: {},
        },
      } as any);
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow();
    });
    it('throws not-found', async () => {
      api.get.mockImplementationOnce(
        () =>
          Promise.reject({
            statusCode: 404,
          }) as any
      );
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow(REPOSITORY_NOT_FOUND);
    });
    it('should throw error if renamed', async () => {
      api.get.mockReturnValueOnce({
        body: {
          fork: true,
          full_name: 'some/other',
          owner: {},
        },
      } as any);
      await expect(
        github.initRepo({
          includeForks: true,
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow(REPOSITORY_RENAMED);
    });
  });
  describe('getRepoForceRebase', () => {
    it('should detect repoForceRebase', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      const res = await github.getRepoForceRebase();
      expect(res).toBe(true);
    });
    it('should handle 404', async () => {
      api.get.mockImplementationOnce(
        () =>
          Promise.reject({
            statusCode: 404,
          }) as any
      );
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
    });
    it('should handle 403', async () => {
      api.get.mockImplementationOnce(
        () =>
          Promise.reject({
            statusCode: 403,
          }) as any
      );
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
    });
    it('should throw 401', async () => {
      api.get.mockImplementationOnce(
        () =>
          Promise.reject({
            statusCode: 401,
          }) as any
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
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [],
          } as any)
      );
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });
    it('should return the PR object', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [{ number: 91, head: { ref: 'somebranch' }, state: 'open' }],
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      api.get.mockResolvedValue({ body: { object: { sha: '12345' } } } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(api.get.mock.calls).toMatchSnapshot();
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
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              state: 'success',
            },
          } as any)
      );
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              state: 'failed',
            },
          } as any)
      );
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('failed');
    });
    it('should fail if a check run has failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              state: 'pending',
              statuses: [],
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('failed');
    });
    it('should suceed if no status and all passed check runs', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              state: 'pending',
              statuses: [],
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should fail if a check run has failed', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              state: 'pending',
              statuses: [],
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
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
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
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
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      const res = await github.getBranchStatusCheck('somebranch', 'context-4');
      expect(res).toBeNull();
    });
  });
  describe('setBranchStatus', () => {
    it('returns if already set', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [
              {
                context: 'some-context',
                state: 'some-state',
              },
            ],
          } as any)
      );
      await github.setBranchStatus({
        branchName: 'some-branch',
        context: 'some-context',
        description: 'some-description',
        state: 'some-state',
        url: 'some-url',
      });
      expect(api.post).toHaveBeenCalledTimes(0);
    });
    it('sets branch status', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1235',
              },
            },
          } as any)
      );
      api.get.mockResolvedValueOnce({
        body: {},
      } as any);
      api.get.mockResolvedValueOnce({
        body: {},
      } as any);
      await github.setBranchStatus({
        branchName: 'some-branch',
        context: 'some-context',
        description: 'some-description',
        state: 'some-state',
        url: 'some-url',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });
  describe('findIssue()', () => {
    beforeEach(() => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
    });
    it('returns null if no issue', async () => {
      const res = await github.findIssue('title-3');
      expect(res).toBeNull();
    });
    it('finds issue', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'new-content' } } as any);
      const res = await github.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      const res = await github.ensureIssue({
        title: 'new-title',
        body: 'new-content',
      });
      expect(res).toEqual('created');
    });
    it('creates issue if not ensuring only once', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'closed',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
      });
      expect(res).toBeNull();
    });
    it('does not create issue if ensuring only once', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'closed',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      const once = true;
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
        once,
      });
      expect(res).toBeNull();
    });
    it('closes others if ensuring only once', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 3,
                    state: 'open',
                    title: 'title-1',
                  },
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'closed',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      const once = true;
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
        once,
      });
      expect(res).toBeNull();
    });
    it('updates issue', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'new-content' } } as any);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toEqual('updated');
    });
    it('skips update if unchanged', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'newer-content' } } as any);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBeNull();
    });
    it('deletes if duplicate', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-1',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'newer-content' } } as any);
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'newer-content',
      });
      expect(res).toBeNull();
    });
    it('creates issue if reopen flag false and issue is not open', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'close',
                    title: 'title-2',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'new-content' } } as any);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toEqual('created');
    });
    it('does not create issue if reopen flag false and issue is already open', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                ],
              },
            },
          },
        },
      });
      api.get.mockReturnValueOnce({ body: { body: 'new-content' } } as any);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toEqual(null);
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      got.mockResolvedValueOnce({
        body: {
          data: {
            repository: {
              issues: {
                pageInfo: {
                  startCursor: null,
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    number: 2,
                    state: 'open',
                    title: 'title-2',
                  },
                  {
                    number: 1,
                    state: 'open',
                    title: 'title-1',
                  },
                ],
              },
            },
          },
        },
      });
      await github.ensureIssueClosing('title-2');
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      await github.deleteLabel(42, 'rebase');
      expect(api.delete.mock.calls).toMatchSnapshot();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      await github.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.post.mockReturnValueOnce({} as any);
      await github.addReviewers(42, [
        'someuser',
        'someotheruser',
        'team:someteam',
      ]);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockReturnValueOnce({ body: [] } as any);
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.post.mock.calls[1]).toMatchSnapshot();
    });
    it('adds comment if found in closed PR list', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.post.mockImplementationOnce(
        () =>
          ({
            body: graphqlClosedPullrequests,
          } as any)
      );
      await github.ensureComment(2499, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.patch).toHaveBeenCalledTimes(0);
    });
    it('add updates comment if necessary', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      } as any);
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(1);
      expect(api.patch.mock.calls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
      } as any);
      await github.ensureComment(42, 'some-subject', 'some\ncontent');
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(0);
    });
    it('handles comment with no description', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '!merge' }],
      } as any);
      await github.ensureComment(42, null, '!merge');
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockReturnValueOnce({
        body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
      } as any);
      await github.ensureCommentRemoval(42, 'some-subject');
      expect(api.delete).toHaveBeenCalledTimes(1);
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      api.get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      } as any);
      const res = await github.findPr('branch-a', null);
      expect(res).toBeDefined();
    });
    it('returns true if not open', async () => {
      api.get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'closed',
          },
        ],
      } as any);
      const res = await github.findPr('branch-a', null, '!open');
      expect(res).toBeDefined();
    });
    it('caches pr list', async () => {
      api.get.mockReturnValueOnce({
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      } as any);
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
      api.post.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 123,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [],
          } as any)
      );
      // res.body.object.sha
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: { sha: 'some-sha' },
            },
          } as any)
      );
      api.get.mockResolvedValueOnce({
        body: {},
      } as any);
      api.get.mockResolvedValueOnce({
        body: [],
      } as any);
      const pr = await github.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
        useDefaultBranch: false,
        platformOptions: { statusCheckVerify: true },
      });
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('should use defaultBranch', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.post.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 123,
            },
          } as any)
      );
      const pr = await github.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: null,
        useDefaultBranch: true,
      });
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await github.getPr(0);
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
      api.post.mockImplementationOnce(
        () =>
          ({
            body: graphqlOpenPullRequests,
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234123412341234123412341234123412341234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(2500);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
    });
    it('should return PR from closed graphql result', async () => {
      await initRepo({
        repository: 'some/repo',
      });
      api.post.mockImplementationOnce(
        () =>
          ({
            body: graphqlOpenPullRequests,
          } as any)
      );
      api.post.mockImplementationOnce(
        () =>
          ({
            body: graphqlClosedPullrequests,
          } as any)
      );
      const pr = await github.getPr(2499);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
    });
    it('should return null if no PR is returned from GitHub', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: null,
          } as any)
      );
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
        api.get.mockImplementationOnce(
          () =>
            ({
              body,
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1234',
                },
              },
            } as any)
        );
        const pr = await github.getPr(1234);
        expect(pr).toMatchSnapshot();
      });
    });
    it('should return a rebaseable PR despite multiple commits', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 1,
              state: 'open',
              mergeable_state: 'dirty',
              base: { sha: '1234' },
              commits: 2,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [
              {
                author: {
                  login: 'foo',
                },
              },
            ],
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return an unrebaseable PR if multiple authors', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 1,
              state: 'open',
              mergeable_state: 'dirty',
              base: { sha: '1234' },
              commits: 2,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return a rebaseable PR if web-flow is second author', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 1,
              state: 'open',
              mergeable_state: 'dirty',
              base: { sha: '1234' },
              commits: 2,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
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
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(false);
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
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 1,
              state: 'open',
              mergeable_state: 'dirty',
              base: { sha: '1234' },
              commits: 1,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [
              {
                commit: {
                  author: {
                    email: 'bot@renovateapp.com',
                  },
                },
              },
            ],
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(false);
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
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              number: 1,
              state: 'open',
              mergeable_state: 'dirty',
              base: { sha: '1234' },
              commits: 1,
            },
          } as any)
      );
      api.get.mockImplementationOnce(
        () =>
          ({
            body: [
              {
                commit: {
                  author: {
                    email: 'foo@bar.com',
                  },
                },
              },
            ],
          } as any)
      );
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1234',
              },
            },
          } as any)
      );
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(true);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getPrFiles()', () => {
    it('should return empty if no prNo is passed', async () => {
      const prFiles = await github.getPrFiles(0);
      expect(prFiles).toEqual([]);
    });
    it('returns files', async () => {
      api.get.mockReturnValueOnce({
        body: [
          { filename: 'renovate.json' },
          { filename: 'not renovate.json' },
        ],
      } as any);
      const prFiles = await github.getPrFiles(123);
      expect(prFiles).toMatchSnapshot();
      expect(prFiles).toHaveLength(2);
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      await github.updatePr(1234, 'The New Title', 'Hello world again');
      expect(api.patch.mock.calls).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo)', () => {
    it('should merge the PR', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      // api.getBranchCommit
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              object: {
                sha: '1235',
              },
            },
          } as any)
      );
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledTimes(1);
    });
    it('should handle merge error', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      api.put.mockImplementationOnce(() => {
        throw new Error('merge error');
      });
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.getPrBody(input)).toMatchSnapshot();
    });
    it('returns not-updated pr body for GHE', async () => {
      api.get.mockImplementationOnce(
        () =>
          ({
            body: {
              login: 'renovate-bot',
            },
          } as any)
      );
      await github.initPlatform({
        endpoint: 'https://github.company.com',
        token: 'abc123',
      });
      hostRules.find.mockReturnValue({
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
      function guessInitRepo(args: any) {
        // repo info
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                owner: {
                  login: 'theowner',
                },
                default_branch: 'master',
              },
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1234',
                },
              },
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1235',
                },
              },
            } as any)
        );
        // api.getBranchCommit
        api.get.mockImplementationOnce(
          () =>
            ({
              body: {
                object: {
                  sha: '1235',
                },
              },
            } as any)
        );
        return github.initRepo(args);
      }
      await guessInitRepo({ repository: 'some/repo', token: 'token' });
      api.put = jest.fn();
    });
    it('should try rebase first', async () => {
      const pr = {
        number: 1235,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(1);
    });
    it('should try squash after rebase', async () => {
      const pr = {
        number: 1236,
        head: {
          ref: 'someref',
        },
      };
      api.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      await github.mergePr(pr.number, '');
      expect(api.put).toHaveBeenCalledTimes(2);
    });
    it('should try merge after squash', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      api.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      api.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(3);
    });
    it('should give up', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      api.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      api.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      api.put.mockImplementationOnce(() => {
        throw new Error('no merging allowed');
      });
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(api.put).toHaveBeenCalledTimes(3);
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty if error', async () => {
      api.get.mockReturnValueOnce({
        body: {},
      } as any);
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
    it('returns array if found', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{\"vulnerabilityAlerts\":{\"edges\":[{\"node\":{\"externalIdentifier\":\"CVE-2018-1000136\",\"externalReference\":\"https://nvd.nist.gov/vuln/detail/CVE-2018-1000136\",\"affectedRange\":\">= 1.8, < 1.8.3\",\"fixedIn\":\"1.8.3\",\"id\":\"MDI4OlJlcG9zaXRvcnlWdWxuZXJhYmlsaXR5QWxlcnQ1MzE3NDk4MQ==\",\"packageName\":\"electron\"}}]}}}}";
      api.post.mockReturnValueOnce({
        body,
      } as any);
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(1);
    });
    it('returns empty if disabled', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{}}}";
      api.post.mockReturnValueOnce({
        body,
      } as any);
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
});
