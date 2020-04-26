import fs from 'fs-extra';
import { GotApi, GotResponse, Platform } from '../common';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
} from '../../constants/error-messages';
import { BranchStatus } from '../../types';
import { mocked } from '../../../test/util';
import { mockGot } from '../../../test/platformUtil';

describe('platform/github', () => {
  let github: Platform;
  let api: jest.Mocked<GotApi>;
  let got: jest.Mock<Promise<Partial<GotResponse>>>;
  let hostRules: jest.Mocked<typeof import('../../util/host-rules')>;
  let GitStorage: jest.Mock<typeof import('../git/storage')>;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.unmock('.');
    jest.mock('delay');
    jest.mock('./gh-got-wrapper');
    jest.mock('../../util/host-rules');
    jest.mock('../../util/got');
    api = mocked((await import('./gh-got-wrapper')).api);
    got = (await import('../../util/got')).default as any;
    github = await import('.');
    hostRules = mocked(await import('../../util/host-rules'));
    jest.mock('../git/storage');
    GitStorage = (await import('../git/storage')).Storage as any;
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
    'lib/platform/github/__fixtures__/graphql/pullrequest-1.json',
    'utf8'
  );
  const graphqlClosedPullrequests = fs.readFileSync(
    'lib/platform/github/__fixtures__/graphql/pullrequests-closed.json',
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
      const httpCalls = mockGot(api, {});
      await expect(github.initPlatform({} as any)).rejects.toThrow();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should throw if user failure', async () => {
      const httpCalls = mockGot(api, {});
      await expect(
        github.initPlatform({ token: 'abc123' } as any)
      ).rejects.toThrow();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should support default endpoint no email access', async () => {
      const httpCalls = mockGot(api, {
        body: {
          login: 'renovate-bot',
        },
      });
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should support default endpoint no email result', async () => {
      const httpCalls = mockGot(api, [
        {
          body: {
            login: 'renovate-bot',
          },
        },
        {
          body: [{}],
        },
      ]);
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should support default endpoint with email', async () => {
      const httpCalls = mockGot(api, [
        {
          body: {
            login: 'renovate-bot',
          },
        },
        {
          body: [
            {
              email: 'user@domain.com',
            },
          ],
        },
      ]);
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should support custom endpoint', async () => {
      const httpCalls = mockGot(api, {
        body: {
          login: 'renovate-bot',
        },
      });
      expect(
        await github.initPlatform({
          endpoint: 'https://ghe.renovatebot.com',
          token: 'abc123',
        })
      ).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos();
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  const initRepoMock = {
    method: 'get',
    body: {
      owner: {
        login: 'theowner',
      },
      default_branch: 'master',
      allow_rebase_merge: true,
      allow_squash_merge: true,
      allow_merge_commit: true,
    },
  };

  function initRepoMocks(): any[] {
    return [
      {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
          allow_rebase_merge: true,
          allow_squash_merge: true,
          allow_merge_commit: true,
        },
      },
    ];
  }

  function forkInitRepoMocks(repo?: string): any[] {
    return [
      // repo info
      {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
          allow_rebase_merge: true,
          allow_squash_merge: true,
          allow_merge_commit: true,
        },
      },
      // getBranchCommit
      {
        body: {
          object: {
            sha: '1234',
          },
        },
      },
      // getRepos
      {
        body: repo
          ? [
              {
                full_name: repo,
              },
            ]
          : [],
      },
      // getBranchCommit
      {
        method: 'post',
        body: repo
          ? {
              full_name: repo,
            }
          : {},
      },
    ];
  }

  describe('initRepo', () => {
    it('should throw err if disabled in renovate.json', async () => {
      // repo info
      const httpCalls = mockGot(api, [
        {
          body: {
            owner: {
              login: 'theowner',
            },
          },
        },
        {
          body: {
            content: Buffer.from('{"enabled": false}').toString('base64'),
          },
        },
      ]);
      await expect(
        github.initRepo({
          repository: 'some/repo',
          optimizeForDisabled: true,
        } as any)
      ).rejects.toThrow(REPOSITORY_DISABLED);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should rebase', async () => {
      const httpCalls = mockGot(api, [
        {
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        },
      ]);
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should forks when forkMode', async () => {
      const httpCalls = mockGot(api, [...forkInitRepoMocks()]);
      const config = await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should update fork when forkMode', async () => {
      const httpCalls = mockGot(api, [...forkInitRepoMocks('forked_repo')]);
      const config = await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should squash', async () => {
      const httpCalls = mockGot(api, {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
          allow_rebase_merge: false,
          allow_squash_merge: true,
          allow_merge_commit: true,
        },
      });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should merge', async () => {
      const httpCalls = mockGot(api, {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
          allow_rebase_merge: false,
          allow_squash_merge: false,
          allow_merge_commit: true,
        },
      });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should not guess at merge', async () => {
      const httpCalls = mockGot(api, {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
        },
      });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should throw error if archived', async () => {
      const httpCalls = mockGot(api, [
        {
          body: {
            archived: true,
            owner: {},
          },
        },
      ]);
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow();
      expect(httpCalls).toMatchSnapshot();
    });
    it('throws not-found', async () => {
      const httpCalls = mockGot(api, {
        statusCode: 404,
      });
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow(REPOSITORY_NOT_FOUND);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should throw error if renamed', async () => {
      const httpCalls = mockGot(api, {
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
        } as any)
      ).rejects.toThrow(REPOSITORY_RENAMED);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getRepoForceRebase', () => {
    it('should detect repoForceRebase', async () => {
      const httpCalls = mockGot(api, {
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
      });
      const res = await github.getRepoForceRebase();
      expect(res).toBe(true);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should handle 404', async () => {
      const httpCalls = mockGot(api, { statusCode: 404 });
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should handle 403', async () => {
      const httpCalls = mockGot(api, { statusCode: 403 });
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should throw 401', async () => {
      const httpCalls = mockGot(api, { statusCode: 401 });
      await expect(github.getRepoForceRebase()).rejects.toEqual({
        statusCode: 401,
      });
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return the PR object', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [
            {
              number: 90,
              head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
              state: 'open',
            },
            {
              number: 91,
              head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
              state: 'open',
            },
          ],
        },
        {
          body: {
            number: 91,
            additions: 1,
            deletions: 1,
            commits: 1,
            base: {
              sha: '1234',
            },
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            state: 'open',
          },
        },
        { body: { object: { sha: '12345' } } },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return the PR object in fork mode', async () => {
      const httpCalls = mockGot(api, [
        ...forkInitRepoMocks('forked/repo'),
        {
          body: [
            {
              number: 90,
              head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
              state: 'open',
            },
            {
              number: 91,
              head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
              state: 'open',
            },
          ],
        },
        {
          body: {
            number: 90,
            additions: 1,
            deletions: 1,
            commits: 1,
            base: {
              sha: '1234',
            },
            head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
            state: 'open',
          },
        },
        { body: { object: { sha: '12345' } } },
      ]);

      await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getBranchStatus()', () => {
    it('returns success if requiredStatusChecks null', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks()]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', null);
      expect(res).toEqual(BranchStatus.green);
      expect(httpCalls).toMatchSnapshot();
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks()]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual(BranchStatus.red);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should pass through success', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'success',
          },
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should pass through failed', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'failure',
          },
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
      expect(httpCalls).toMatchSnapshot();
    });
    it('defaults to pending', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'unknown',
          },
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should fail if a check run has failed', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'pending',
            statuses: [],
          },
        },
        {
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
                conclusion: 'failure',
                name: 'Travis CI - Branch',
              },
            ],
          },
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should suceed if no status and all passed check runs', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'pending',
            statuses: [],
          },
        },
        {
          body: {
            total_count: 3,
            check_runs: [
              {
                id: 2390199,
                status: 'completed',
                conclusion: 'skipped',
                name: 'Conditional GitHub Action',
              },
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
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should fail if a check run has failed', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            state: 'pending',
            statuses: [],
          },
        },
        {
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
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getBranchStatusCheck', () => {
    it('returns state if found', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [
            {
              context: 'context-1',
              state: 'success',
            },
            {
              context: 'context-2',
              state: 'pending',
            },
            {
              context: 'context-3',
              state: 'failure',
            },
          ],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
        token: 'token',
      } as any);
      const res = await github.getBranchStatusCheck(
        'renovate/future_branch',
        'context-2'
      );
      expect(res).toEqual(BranchStatus.yellow);
      expect(httpCalls).toMatchSnapshot();
    });
    it('returns null', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [
            {
              context: 'context-1',
              state: 'success',
            },
            {
              context: 'context-2',
              state: 'pending',
            },
            {
              context: 'context-3',
              state: 'error',
            },
          ],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatusCheck('somebranch', 'context-4');
      expect(res).toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('setBranchStatus', () => {
    it('returns if already set', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [
            {
              context: 'some-context',
              state: 'pending',
            },
          ],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.setBranchStatus({
        branchName: 'some-branch',
        context: 'some-context',
        description: 'some-description',
        state: BranchStatus.yellow,
        url: 'some-url',
      });
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(httpCalls).toMatchSnapshot();
    });
    it('sets branch status', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
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
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1235',
            },
          },
        },
        {
          body: {},
        },
        {
          body: {},
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.setBranchStatus({
        branchName: 'some-branch',
        context: 'some-context',
        description: 'some-description',
        state: BranchStatus.green,
        url: 'some-url',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('findIssue()', () => {
    const issueResponseMock = {
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
    };

    it('returns null if no issue', async () => {
      const httpCalls = mockGot(api, issueResponseMock);
      const res = await github.findIssue('title-3');
      expect(res).toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
    it('finds issue', async () => {
      const httpCalls = mockGot(api, [
        issueResponseMock,
        { body: { body: 'new-content' } },
      ]);
      mockGot(
        got as any,
        {
          method: 'post',
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
        },
        httpCalls
      );
      const res = await github.findIssue('title-2');
      expect(res).not.toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      expect(httpCalls).toMatchSnapshot();
    });
    it('creates issue if not ensuring only once', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      expect(httpCalls).toMatchSnapshot();
    });
    it('does not create issue if ensuring only once', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      expect(httpCalls).toMatchSnapshot();
    });
    it('closes others if ensuring only once', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      expect(httpCalls).toMatchSnapshot();
    });
    it('updates issue', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      mockGot(api, { body: { body: 'new-content' } }, httpCalls);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toEqual('updated');
      expect(httpCalls).toMatchSnapshot();
    });
    it('skips update if unchanged', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      mockGot(api, { body: { body: 'newer-content' } }, httpCalls);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
    it('deletes if duplicate', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      mockGot(api, { body: { body: 'newer-content' } }, httpCalls);
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'newer-content',
      });
      expect(res).toBeNull();
      expect(httpCalls).toMatchSnapshot();
    });
    it('creates issue if reopen flag false and issue is not open', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      mockGot(api, { body: { body: 'new-content' } }, httpCalls);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toEqual('created');
      expect(httpCalls).toMatchSnapshot();
    });
    it('does not create issue if reopen flag false and issue is already open', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      mockGot(api, { body: { body: 'new-content' } }, httpCalls);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toEqual(null);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      const httpCalls = mockGot(got as any, {
        method: 'post',
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
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks()]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.deleteLabel(42, 'rebase');
      expect(api.delete.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks()]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.post.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: {},
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.addReviewers(42, [
        'someuser',
        'someotheruser',
        'team:someteam',
      ]);
      expect(api.post.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks(), { body: [] }]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.post.mock.calls[1]).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('adds comment if found in closed PR list', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: graphqlClosedPullrequests,
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 2499,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.patch).toHaveBeenCalledTimes(0);
      expect(httpCalls).toMatchSnapshot();
    });
    it('add updates comment if necessary', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(1);
      expect(api.patch.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(0);
      expect(httpCalls).toMatchSnapshot();
    });
    it('handles comment with no description', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [{ id: 1234, body: '!merge' }],
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: null,
        content: '!merge',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledTimes(0);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment if found', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.ensureCommentRemoval(42, 'some-subject');
      expect(api.delete).toHaveBeenCalledTimes(1);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      const httpCalls = mockGot(api, {
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      });
      const res = await github.findPr({
        branchName: 'branch-a',
      });
      expect(res).toBeDefined();
      expect(httpCalls).toMatchSnapshot();
    });
    it('returns true if not open', async () => {
      const httpCalls = mockGot(api, {
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'closed',
          },
        ],
      });
      const res = await github.findPr({
        branchName: 'branch-a',
        state: '!open',
      });
      expect(res).toBeDefined();
      expect(httpCalls).toMatchSnapshot();
    });
    it('caches pr list', async () => {
      const httpCalls = mockGot(api, {
        body: [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: 'open',
          },
        ],
      });
      let res = await github.findPr({ branchName: 'branch-a' });
      expect(res).toBeDefined();
      res = await github.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeDefined();
      res = await github.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'open',
      });
      expect(res).toBeDefined();
      res = await github.findPr({ branchName: 'branch-b' });
      expect(res).not.toBeDefined();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: {
            number: 123,
          },
        },
        { body: [] },
        // res.body.object.sha
        {
          body: {
            object: { sha: 'some-sha' },
          },
        },
        { body: {} },
        { body: [] },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
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
      expect(httpCalls).toMatchSnapshot();
    });
    it('should use defaultBranch', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: {
            number: 123,
          },
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: null,
        useDefaultBranch: true,
      });
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await github.getPr(0);
      expect(pr).toBeNull();
    });
    it('should return PR from graphql result', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: graphqlOpenPullRequests,
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234123412341234123412341234123412341234',
            },
          },
        },
      ]);
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(2500);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return PR from closed graphql result', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          method: 'post',
          body: graphqlOpenPullRequests,
        },
        {
          method: 'post',
          body: graphqlClosedPullrequests,
        },
      ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(2499);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return null if no PR is returned from GitHub', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: null,
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.getPr(1234);
      expect(pr).toBeNull();
      expect(httpCalls).toMatchSnapshot();
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
        const httpCalls = mockGot(api, [
          ...initRepoMocks(),
          {
            body,
          },
          // api.getBranchCommit
          {
            body: {
              object: {
                sha: '1234',
              },
            },
          },
        ]);
        await github.initRepo({
          repository: 'some/repo',
          token: 'token',
        } as any);
        const pr = await github.getPr(1234);
        expect(pr).toMatchSnapshot();
        expect(httpCalls).toMatchSnapshot();
      });
    });
    it('should return a rebaseable PR despite multiple commits', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            number: 1,
            state: 'open',
            mergeable_state: 'dirty',
            base: { sha: '1234' },
            commits: 2,
          },
        },
        {
          body: [
            {
              author: {
                login: 'foo',
              },
            },
          ],
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234',
            },
          },
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return an unrebaseable PR if multiple authors', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            number: 1,
            state: 'open',
            mergeable_state: 'dirty',
            base: { sha: '1234' },
            commits: 2,
          },
        },
        {
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
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234',
            },
          },
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return a rebaseable PR if web-flow is second author', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            number: 1,
            state: 'open',
            mergeable_state: 'dirty',
            base: { sha: '1234' },
            commits: 2,
          },
        },
        {
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
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234',
            },
          },
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(false);
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return a rebaseable PR if gitAuthor matches 1 commit', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            number: 1,
            state: 'open',
            mergeable_state: 'dirty',
            base: { sha: '1234' },
            commits: 1,
          },
        },
        {
          body: [
            {
              commit: {
                author: {
                  email: 'bot@renovateapp.com',
                },
              },
            },
          ],
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234',
            },
          },
        },
      ]);
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(false);
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
    it('should return a not rebaseable PR if gitAuthor does not match 1 commit', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        {
          body: {
            number: 1,
            state: 'open',
            mergeable_state: 'dirty',
            base: { sha: '1234' },
            commits: 1,
          },
        },
        {
          body: [
            {
              commit: {
                author: {
                  email: 'foo@bar.com',
                },
              },
            },
          ],
        },
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1234',
            },
          },
        },
      ]);
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'bot@renovateapp.com',
      };
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(1234);
      expect(pr.isModified).toBe(true);
      expect(pr).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getPrFiles()', () => {
    it('should return empty if no prNo is passed', async () => {
      const prFiles = await github.getPrFiles(0);
      expect(prFiles).toEqual([]);
    });
    it('returns files', async () => {
      const httpCalls = mockGot(api, {
        body: [
          { filename: 'renovate.json' },
          { filename: 'not renovate.json' },
        ],
      });
      const prFiles = await github.getPrFiles(123);
      expect(prFiles).toMatchSnapshot();
      expect(prFiles).toHaveLength(2);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      const httpCalls = mockGot(api, [...initRepoMocks()]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.updatePr(1234, 'The New Title', 'Hello world again');
      expect(api.patch.mock.calls).toMatchSnapshot();
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo)', () => {
    it('should merge the PR', async () => {
      const httpCalls = mockGot(api, [
        ...initRepoMocks(),
        // api.getBranchCommit
        {
          body: {
            object: {
              sha: '1235',
            },
          },
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should handle merge error', async () => {
      const httpCalls = mockGot(api, [
        initRepoMock,
        {
          method: 'put',
          error: 'merge error',
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.getPrBody(input)).toMatchSnapshot();
    });
    it('returns not-updated pr body for GHE', async () => {
      const httpCalls = mockGot(api, [
        {
          body: {
            login: 'renovate-bot',
          },
        },
        {},
        ...initRepoMocks(),
      ]);
      await github.initPlatform({
        endpoint: 'https://github.company.com',
        token: 'abc123',
      });
      hostRules.find.mockReturnValue({
        token: 'abc123',
      });
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.getPrBody(input)).toEqual(input);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo) - autodetection', () => {
    const guessInitRepoMocks = [
      // repo info
      {
        body: {
          owner: {
            login: 'theowner',
          },
          default_branch: 'master',
        },
      },
      // getBranchCommit
      {
        body: {
          object: {
            sha: '1234',
          },
        },
      },
      // getBranchCommit
      {
        body: {
          object: {
            sha: '1235',
          },
        },
      },
      // getBranchCommit
      {
        body: {
          object: {
            sha: '1235',
          },
        },
      },
    ];
    it('should try rebase first', async () => {
      const httpCalls = mockGot(api, guessInitRepoMocks);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1235,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should try squash after rebase', async () => {
      const httpCalls = mockGot(api, [
        ...guessInitRepoMocks,
        {
          method: 'put',
          error: 'no rebasing allowed',
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1236,
        head: {
          ref: 'someref',
        },
      };
      await github.mergePr(pr.number, '');
      expect(api.put).toHaveBeenCalledTimes(2);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should try merge after squash', async () => {
      const httpCalls = mockGot(api, [
        ...guessInitRepoMocks,
        {
          method: 'put',
          error: 'no rebasing allowed',
        },
        {
          method: 'put',
          error: 'no squashing allowed',
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(api.put).toHaveBeenCalledTimes(3);
      expect(httpCalls).toMatchSnapshot();
    });
    it('should give up', async () => {
      const httpCalls = mockGot(api, [
        ...guessInitRepoMocks,
        {
          method: 'put',
          error: 'no rebasing allowed',
        },
        {
          method: 'put',
          error: 'no squashing allowed',
        },
        {
          method: 'put',
          error: 'no merging allowed',
        },
      ]);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(api.put).toHaveBeenCalledTimes(3);
      expect(httpCalls).toMatchSnapshot();
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty if error', async () => {
      const httpCalls = mockGot(api, {
        body: {},
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
      expect(httpCalls).toMatchSnapshot();
    });
    it('returns array if found', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{\"vulnerabilityAlerts\":{\"edges\":[{\"node\":{\"externalIdentifier\":\"CVE-2018-1000136\",\"externalReference\":\"https://nvd.nist.gov/vuln/detail/CVE-2018-1000136\",\"affectedRange\":\">= 1.8, < 1.8.3\",\"fixedIn\":\"1.8.3\",\"id\":\"MDI4OlJlcG9zaXRvcnlWdWxuZXJhYmlsaXR5QWxlcnQ1MzE3NDk4MQ==\",\"packageName\":\"electron\"}}]}}}}";
      const httpCalls = mockGot(api, {
        method: 'post',
        body,
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(1);
      expect(httpCalls).toMatchSnapshot();
    });
    it('returns empty if disabled', async () => {
      // prettier-ignore
      const body = "{\"data\":{\"repository\":{}}}";
      const httpCalls = mockGot(api, {
        method: 'post',
        body,
      });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
      expect(httpCalls).toMatchSnapshot();
    });
  });
});
