import fs from 'fs-extra';
import { DateTime } from 'luxon';
import * as httpMock from '../../../test/http-mock';
import { getName, mocked } from '../../../test/util';
import {
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
} from '../../constants/error-messages';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../types';
import * as _git from '../../util/git';
import type { Platform } from '../types';

const githubApiHost = 'https://api.github.com';

describe(getName(__filename), () => {
  let github: Platform;
  let hostRules: jest.Mocked<typeof import('../../util/host-rules')>;
  let git: jest.Mocked<typeof _git>;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.unmock('.');
    jest.mock('delay');
    jest.mock('../../util/host-rules');
    github = await import('.');
    hostRules = mocked(await import('../../util/host-rules'));
    jest.mock('../../util/git');
    git = mocked(await import('../../util/git'));
    git.branchExists.mockReturnValue(true);
    git.isBranchStale.mockResolvedValue(true);
    git.getBranchCommit.mockReturnValue(
      '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
    );
    delete global.gitAuthor;
    hostRules.find.mockReturnValue({
      token: 'abc123',
    });
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  const graphqlOpenPullRequests = fs.readFileSync(
    'lib/platform/github/__fixtures__/graphql/pullrequest-1.json',
    'utf8'
  );
  const graphqlClosedPullRequests = fs.readFileSync(
    'lib/platform/github/__fixtures__/graphql/pullrequests-closed.json',
    'utf8'
  );

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(github.initPlatform({} as any)).rejects.toThrow(
        'Init: You must configure a GitHub personal access token'
      );
    });
    it('should throw if user failure', async () => {
      httpMock.scope(githubApiHost).get('/user').reply(404);
      await expect(
        github.initPlatform({ token: 'abc123' } as any)
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should support default endpoint no email access', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/user')
        .reply(200, {
          login: 'renovate-bot',
        })
        .get('/user/emails')
        .reply(400);
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should support default endpoint no email result', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/user')
        .reply(200, {
          login: 'renovate-bot',
        })
        .get('/user/emails')
        .reply(200, [{}]);
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should support gitAuthor and username', async () => {
      expect(
        await github.initPlatform({
          token: 'abc123',
          username: 'renovate-bot',
          gitAuthor: 'renovate@whitesourcesoftware.com',
        } as any)
      ).toMatchSnapshot();
    });
    it('should support default endpoint with email', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/user')
        .reply(200, {
          login: 'renovate-bot',
        })
        .get('/user/emails')
        .reply(200, [
          {
            email: 'user@domain.com',
          },
        ]);
      expect(
        await github.initPlatform({ token: 'abc123' } as any)
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should support custom endpoint', async () => {
      httpMock
        .scope('https://ghe.renovatebot.com')
        .get('/user')
        .reply(200, {
          login: 'renovate-bot',
        })
        .get('/user/emails')
        .reply(200, [
          {
            email: 'user@domain.com',
          },
        ]);
      expect(
        await github.initPlatform({
          endpoint: 'https://ghe.renovatebot.com',
          token: 'abc123',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    it('should return an array of repos', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/user/repos?per_page=100')
        .reply(200, [
          {
            full_name: 'a/b',
          },
          {
            full_name: 'c/d',
          },
        ]);
      const repos = await github.getRepos();
      expect(repos).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  function initRepoMock(scope: httpMock.Scope, repository: string): void {
    scope.post(`/graphql`).reply(200, {
      data: {
        repository: {
          isFork: false,
          isArchived: false,
          nameWithOwner: repository,
          mergeCommitAllowed: true,
          rebaseMergeAllowed: true,
          squashMergeAllowed: true,
          defaultBranchRef: {
            name: 'master',
            target: {
              oid: '1234',
            },
          },
        },
      },
    });
  }

  function forkInitRepoMock(
    scope: httpMock.Scope,
    repository: string,
    forkExisted: boolean,
    forkDefaulBranch = 'master'
  ): void {
    scope
      // repo info
      .post(`/graphql`)
      .reply(200, {
        data: {
          repository: {
            isFork: false,
            isArchived: false,
            nameWithOwner: repository,
            mergeCommitAllowed: true,
            rebaseMergeAllowed: true,
            squashMergeAllowed: true,
            defaultBranchRef: {
              name: 'master',
              target: {
                oid: '1234',
              },
            },
          },
        },
      })
      // getRepos
      .get('/user/repos?per_page=100')
      .reply(
        200,
        forkExisted
          ? [{ full_name: 'forked/repo', default_branch: forkDefaulBranch }]
          : []
      )
      // getBranchCommit
      .post(`/repos/${repository}/forks`)
      .reply(200, {
        full_name: 'forked/repo',
        default_branch: forkDefaulBranch,
      });
  }

  describe('initRepo', () => {
    it('should rebase', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should fork when forkMode', async () => {
      const scope = httpMock.scope(githubApiHost);
      forkInitRepoMock(scope, 'some/repo', false);
      const config = await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should update fork when forkMode', async () => {
      const scope = httpMock.scope(githubApiHost);
      forkInitRepoMock(scope, 'some/repo', true);
      scope.patch('/repos/forked/repo/git/refs/heads/master').reply(200);
      const config = await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('detects fork default branch mismatch', async () => {
      const scope = httpMock.scope(githubApiHost);
      forkInitRepoMock(scope, 'some/repo', true, 'not_master');
      scope.post('/repos/forked/repo/git/refs').reply(200);
      scope.patch('/repos/forked/repo').reply(200);
      scope.patch('/repos/forked/repo/git/refs/heads/master').reply(200);
      const config = await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should squash', async () => {
      httpMock
        .scope(githubApiHost)
        .post(`/graphql`)
        .reply(200, {
          data: {
            repository: {
              isFork: false,
              isArchived: false,
              nameWithOwner: 'some/repo',
              mergeCommitAllowed: true,
              rebaseMergeAllowed: false,
              squashMergeAllowed: true,
              defaultBranchRef: {
                name: 'master',
                target: {
                  oid: '1234',
                },
              },
            },
          },
        });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should merge', async () => {
      httpMock
        .scope(githubApiHost)
        .post(`/graphql`)
        .reply(200, {
          data: {
            repository: {
              isFork: false,
              isArchived: false,
              nameWithOwner: 'some/repo',
              mergeCommitAllowed: true,
              rebaseMergeAllowed: false,
              squashMergeAllowed: false,
              defaultBranchRef: {
                name: 'master',
                target: {
                  oid: '1234',
                },
              },
            },
          },
        });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should not guess at merge', async () => {
      httpMock
        .scope(githubApiHost)
        .post(`/graphql`)
        .reply(200, {
          data: {
            repository: {
              defaultBranchRef: {
                name: 'master',
                target: {
                  oid: '1234',
                },
              },
            },
          },
        });
      const config = await github.initRepo({
        repository: 'some/repo',
      } as any);
      expect(config).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should throw error if archived', async () => {
      httpMock
        .scope(githubApiHost)
        .post(`/graphql`)
        .reply(200, {
          data: {
            repository: {
              isArchived: true,
              nameWithOwner: 'some/repo',
              defaultBranchRef: {
                name: 'master',
                target: {
                  oid: '1234',
                },
              },
            },
          },
        });
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws not-found', async () => {
      httpMock.scope(githubApiHost).post(`/graphql`).reply(404);
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow(REPOSITORY_NOT_FOUND);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should throw error if renamed', async () => {
      httpMock
        .scope(githubApiHost)
        .post(`/graphql`)
        .reply(200, {
          data: {
            repository: {
              nameWithOwner: 'some/other',
              defaultBranchRef: {
                name: 'master',
                target: {
                  oid: '1234',
                },
              },
            },
          },
        });
      await expect(
        github.initRepo({
          repository: 'some/repo',
        } as any)
      ).rejects.toThrow(REPOSITORY_RENAMED);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getRepoForceRebase', () => {
    it('should detect repoForceRebase', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/branches/undefined/protection')
        .reply(200, {
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
        });
      const res = await github.getRepoForceRebase();
      expect(res).toBe(true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should handle 404', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/branches/undefined/protection')
        .reply(404);
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should handle 403', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/branches/undefined/protection')
        .reply(403);
      const res = await github.getRepoForceRebase();
      expect(res).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should throw 401', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/branches/undefined/protection')
        .reply(401);
      await expect(
        github.getRepoForceRebase()
      ).rejects.toThrowErrorMatchingSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.get('/repos/some/repo/pulls?per_page=100&state=all').reply(200, []);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should return the PR object', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .twice() // getOpenPrs() and getClosedPrs()
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 90,
            head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
            state: PrState.Open,
          },
          {
            number: 91,
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            state: PrState.Open,
          },
        ])
        .get('/repos/some/repo/pulls/91')
        .reply(200, {
          number: 91,
          additions: 1,
          deletions: 1,
          commits: 1,
          base: {
            sha: '1234',
          },
          head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
          state: PrState.Open,
        });

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should reopen an autoclosed PR', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .twice() // getOpenPrs() and getClosedPrs()
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 90,
            head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
            state: PrState.Open,
          },
          {
            number: 91,
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            title: 'old title - autoclosed',
            state: PrState.Closed,
            closed_at: DateTime.now().minus({ days: 6 }).toISO(),
          },
        ])
        .post('/repos/some/repo/git/refs')
        .reply(201)
        .patch('/repos/some/repo/pulls/91')
        .reply(201)
        .get('/repos/some/repo/pulls/91')
        .reply(200, {
          number: 91,
          additions: 1,
          deletions: 1,
          commits: 1,
          base: {
            sha: '1234',
          },
          head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
          state: PrState.Open,
        });

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('aborts reopen if PR is too old', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.get('/repos/some/repo/pulls?per_page=100&state=all').reply(200, [
        {
          number: 90,
          head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
          state: PrState.Open,
        },
        {
          number: 91,
          head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
          title: 'old title - autoclosed',
          state: PrState.Closed,
          closed_at: DateTime.now().minus({ days: 7 }).toISO(),
        },
      ]);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('aborts reopening if branch recreation fails', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 91,
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            title: 'old title - autoclosed',
            state: PrState.Closed,
            closed_at: DateTime.now().minus({ minutes: 10 }).toISO(),
          },
        ])
        .post('/repos/some/repo/git/refs')
        .reply(201)
        .patch('/repos/some/repo/pulls/91')
        .reply(422);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('aborts reopening if PR reopening fails', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 91,
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            title: 'old title - autoclosed',
            state: PrState.Closed,
            closed_at: DateTime.now().minus({ minutes: 10 }).toISO(),
          },
        ])
        .post('/repos/some/repo/git/refs')
        .reply(422);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should return the PR object in fork mode', async () => {
      const scope = httpMock.scope(githubApiHost);
      forkInitRepoMock(scope, 'some/repo', true);
      scope
        .post('/graphql')
        .twice() // getOpenPrs() and getClosedPrs()
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 90,
            head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
            state: PrState.Open,
          },
          {
            number: 91,
            head: { ref: 'somebranch', repo: { full_name: 'some/repo' } },
            state: PrState.Open,
          },
        ])
        .get('/repos/some/repo/pulls/90')
        .reply(200, {
          number: 90,
          additions: 1,
          deletions: 1,
          commits: 1,
          base: {
            sha: '1234',
          },
          head: { ref: 'somebranch', repo: { full_name: 'other/repo' } },
          state: PrState.Open,
        })
        .patch('/repos/forked/repo/git/refs/heads/master')
        .reply(200);
      await github.initRepo({
        repository: 'some/repo',
        forkMode: true,
      } as any);
      const pr = await github.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getBranchStatus()', () => {
    it('returns success if requiredStatusChecks null', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', null);
      expect(res).toEqual(BranchStatus.green);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual(BranchStatus.red);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should pass through success', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'success',
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, []);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should pass through failed', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'failure',
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, []);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('defaults to pending', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'unknown',
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, []);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should fail if a check run has failed', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'pending',
          statuses: [],
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, {
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
        });
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should succeed if no status and all passed check runs', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'pending',
          statuses: [],
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, {
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
        });
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should fail if a check run is pending', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/commits/somebranch/status')
        .reply(200, {
          state: 'pending',
          statuses: [],
        })
        .get('/repos/some/repo/commits/somebranch/check-runs?per_page=100')
        .reply(200, {
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
        });
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getBranchStatusCheck', () => {
    it('returns state if found', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get(
          '/repos/some/repo/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get(
          '/repos/some/repo/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
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
        ]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const res = await github.getBranchStatusCheck('somebranch', 'context-4');
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('setBranchStatus', () => {
    it('returns if already set', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get(
          '/repos/some/repo/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
          {
            context: 'some-context',
            state: 'pending',
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('sets branch status', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get(
          '/repos/some/repo/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
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
        ])
        .post(
          '/repos/some/repo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e'
        )
        .reply(200)
        .get('/repos/some/repo/commits/some-branch/status')
        .reply(200, {})
        .get(
          '/repos/some/repo/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, {});

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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        });
      const res = await github.findIssue('title-3');
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('finds issue', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'new-content' });
      const res = await github.findIssue('title-2');
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .post('/repos/undefined/issues')
        .reply(200);
      const res = await github.ensureIssue({
        title: 'new-title',
        body: 'new-content',
      });
      expect(res).toEqual('created');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('creates issue if not ensuring only once', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/1')
        .reply(404);
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('does not create issue if ensuring only once', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        });
      const once = true;
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
        once,
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('closes others if ensuring only once', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/3')
        .reply(404);
      const once = true;
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'new-content',
        once,
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('updates issue', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'new-content' })
        .patch('/repos/undefined/issues/2')
        .reply(200);
      const res = await github.ensureIssue({
        title: 'title-3',
        reuseTitle: 'title-2',
        body: 'newer-content',
      });
      expect(res).toEqual('updated');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('skips update if unchanged', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'newer-content' });
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('deletes if duplicate', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .patch('/repos/undefined/issues/1')
        .reply(200)
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'newer-content' });
      const res = await github.ensureIssue({
        title: 'title-1',
        body: 'newer-content',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('creates issue if reopen flag false and issue is not open', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'new-content' })
        .post('/repos/undefined/issues')
        .reply(200);
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toEqual('created');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('does not create issue if reopen flag false and issue is already open', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .get('/repos/undefined/issues/2')
        .reply(200, { body: 'new-content' });
      const res = await github.ensureIssue({
        title: 'title-2',
        body: 'new-content',
        once: false,
        shouldReOpen: false,
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
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
        })
        .patch('/repos/undefined/issues/2')
        .reply(200);
      await github.ensureIssueClosing('title-2');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.delete('/repos/some/repo/issues/42/labels/rebase').reply(200);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.deleteLabel(42, 'rebase');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.post('/repos/some/repo/issues/42/assignees').reply(200);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.addAssignees(42, ['someuser', 'someotheruser']);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.post('/repos/some/repo/pulls/42/requested_reviewers').reply(200);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.addReviewers(42, [
        'someuser',
        'someotheruser',
        'team:someteam',
      ]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [])
        .post('/repos/some/repo/issues/42/comments')
        .reply(200);

      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds comment if found in closed PR list', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, graphqlClosedPullRequests)
        .post('/repos/some/repo/issues/2499/comments')
        .reply(200);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 2499,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('add updates comment if necessary', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nblablabla' }])
        .patch('/repos/some/repo/issues/comments/1234')
        .reply(200);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('skips comment', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles comment with no description', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [{ id: 1234, body: '!merge' }]);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      await github.ensureComment({
        number: 42,
        topic: null,
        content: '!merge',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment by topic if found', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nblablabla' }])
        .delete('/repos/some/repo/issues/comments/1234')
        .reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.ensureCommentRemoval({ number: 42, topic: 'some-subject' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('deletes comment by content if found', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, {
          data: { repository: { pullRequests: { pageInfo: {} } } },
        })
        .get('/repos/some/repo/issues/42/comments?per_page=100')
        .reply(200, [{ id: 1234, body: 'some-content' }])
        .delete('/repos/some/repo/issues/comments/1234')
        .reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.ensureCommentRemoval({
        number: 42,
        content: 'some-content',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      const scope = httpMock
        .scope(githubApiHost)
        .get('/repos/some/repo/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 2,
            head: {
              ref: 'branch-a',
              repo: { full_name: 'some/repo' },
            },
            title: 'branch a pr',
            state: PrState.Open,
            user: { login: 'not-me' },
          },
          {
            number: 1,
            head: {
              ref: 'branch-a',
              repo: { full_name: 'some/repo' },
            },
            title: 'branch a pr',
            state: PrState.Open,
            user: { login: 'me' },
          },
        ]);
      initRepoMock(scope, 'some/repo');
      await github.initRepo({
        repository: 'some/repo',
        token: 'token',
        renovateUsername: 'me',
      } as any);

      const res = await github.findPr({
        branchName: 'branch-a',
      });
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns true if not open', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: PrState.Closed,
          },
        ]);

      const res = await github.findPr({
        branchName: 'branch-a',
        state: PrState.NotOpen,
      });
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('caches pr list', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/undefined/pulls?per_page=100&state=all')
        .reply(200, [
          {
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            state: PrState.Open,
          },
        ]);
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
        state: PrState.Open,
      });
      expect(res).toBeDefined();
      res = await github.findPr({ branchName: 'branch-b' });
      expect(res).not.toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/repos/some/repo/pulls')
        .reply(200, {
          number: 123,
          head: { repo: { full_name: 'some/repo' } },
        })
        .post('/repos/some/repo/issues/123/labels')
        .reply(200, []);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'dev',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
      });
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should use defaultBranch', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.post('/repos/some/repo/pulls').reply(200, {
        number: 123,
        head: { repo: { full_name: 'some/repo' } },
      });
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: null,
      });
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should create a draftPR if set in the settings', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.post('/repos/some/repo/pulls').reply(200, {
        number: 123,
        head: { repo: { full_name: 'some/repo' } },
      });
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'PR draft',
        prBody: 'This is a result of a draft',
        labels: null,
        draftPR: true,
      });
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await github.getPr(0);
      expect(pr).toBeNull();
    });
    it('should return PR from graphql result', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.post('/graphql').reply(200, graphqlOpenPullRequests);
      global.gitAuthor = {
        name: 'Renovate Bot',
        email: 'renovate@whitesourcesoftware.com',
      };
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(2500);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should return PR from closed graphql result', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .post('/graphql')
        .reply(200, graphqlOpenPullRequests)
        .post('/graphql')
        .reply(200, graphqlClosedPullRequests);
      await github.initRepo({
        repository: 'some/repo',
      } as any);
      const pr = await github.getPr(2499);
      expect(pr).toBeDefined();
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should return null if no PR is returned from GitHub', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls/1234')
        .reply(200)
        .post('/graphql')
        .twice()
        .reply(404);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = await github.getPr(1234);
      expect(pr).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it(`should return a PR object - 0`, async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls/1234')
        .reply(200, {
          number: 1,
          state: PrState.Closed,
          base: { sha: '1234' },
          mergeable: true,
          merged_at: 'sometime',
        })
        .post('/graphql')
        .twice()
        .reply(404);
      await github.initRepo({
        repository: 'some/repo',
        token: 'token',
      } as any);
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it(`should return a PR object - 1`, async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls/1234')
        .reply(200, {
          number: 1,
          state: PrState.Open,
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 1,
        })
        .post('/graphql')
        .twice()
        .reply(404);
      await github.initRepo({
        repository: 'some/repo',
        token: 'token',
      } as any);
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it(`should return a PR object - 2`, async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .get('/repos/some/repo/pulls/1234')
        .reply(200, {
          number: 1,
          state: PrState.Open,
          base: { sha: '5678' },
          commits: 1,
          mergeable: true,
        })
        .post('/graphql')
        .twice()
        .reply(404);
      await github.initRepo({
        repository: 'some/repo',
        token: 'token',
      } as any);
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.patch('/repos/some/repo/pulls/1234').reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should update and close the PR', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.patch('/repos/some/repo/pulls/1234').reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      await github.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        state: PrState.Closed,
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo)', () => {
    it('should merge the PR', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.put('/repos/some/repo/pulls/1234/merge').reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should handle merge error', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .put('/repos/some/repo/pulls/1234/merge')
        .replyWithError('merge error');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('massageMarkdown(input)', () => {
    it('returns updated pr body', () => {
      const input =
        'https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(github.massageMarkdown(input)).toMatchSnapshot();
    });
    it('returns not-updated pr body for GHE', async () => {
      const scope = httpMock
        .scope('https://github.company.com')
        .get('/user')
        .reply(200, {
          login: 'renovate-bot',
        })
        .get('/user/emails')
        .reply(200, {});
      initRepoMock(scope, 'some/repo');
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
      expect(github.massageMarkdown(input)).toEqual(input);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo) - autodetection', () => {
    it('should try rebase first', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope.put('/repos/some/repo/pulls/1235/merge').reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1235,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should try squash after rebase', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .put('/repos/some/repo/pulls/1236/merge')
        .reply(400, 'no rebasing allowed');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1236,
        head: {
          ref: 'someref',
        },
      };
      await github.mergePr(pr.number, '');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should try merge after squash', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .put('/repos/some/repo/pulls/1237/merge')
        .reply(405, 'no rebasing allowed')
        .put('/repos/some/repo/pulls/1237/merge')
        .reply(405, 'no squashing allowed')
        .put('/repos/some/repo/pulls/1237/merge')
        .reply(200);
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(true);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should give up', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      scope
        .put('/repos/some/repo/pulls/1237/merge')
        .reply(405, 'no rebasing allowed')
        .put('/repos/some/repo/pulls/1237/merge')
        .replyWithError('no squashing allowed')
        .put('/repos/some/repo/pulls/1237/merge')
        .replyWithError('no merging allowed')
        .put('/repos/some/repo/pulls/1237/merge')
        .replyWithError('never gonna give you up');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr.number, '')).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty if error', async () => {
      httpMock.scope(githubApiHost).post('/graphql').reply(200, {});
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns array if found', async () => {
      httpMock
        .scope(githubApiHost)
        .post('/graphql')
        .reply(200, {
          data: {
            repository: {
              vulnerabilityAlerts: {
                edges: [
                  {
                    node: {
                      securityAdvisory: { severity: 'HIGH', references: [] },
                      securityVulnerability: {
                        package: {
                          ecosystem: 'NPM',
                          name: 'left-pad',
                          range: '0.0.2',
                        },
                        vulnerableVersionRange: '0.0.2',
                        firstPatchedVersion: { identifier: '0.0.3' },
                      },
                      vulnerableManifestFilename: 'foo',
                      vulnerableManifestPath: 'bar',
                    } as VulnerabilityAlert,
                  },
                ],
              },
            },
          },
        });
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns empty if disabled', async () => {
      // prettier-ignore
      httpMock.scope(githubApiHost).post('/graphql').reply(200, {data: { repository: {} }} );
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles network error', async () => {
      // prettier-ignore
      httpMock.scope(githubApiHost).post('/graphql').replyWithError('unknown error');
      const res = await github.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      scope.get('/repos/some/repo/contents/file.json').reply(200, {
        content: Buffer.from(JSON.stringify(data)).toString('base64'),
      });
      const res = await github.getJsonFile('file.json');
      expect(res).toEqual(data);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws on malformed JSON', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      scope.get('/repos/some/repo/contents/file.json').reply(200, {
        content: Buffer.from('!@#').toString('base64'),
      });
      await expect(github.getJsonFile('file.json')).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws on errors', async () => {
      const scope = httpMock.scope(githubApiHost);
      initRepoMock(scope, 'some/repo');
      await github.initRepo({ repository: 'some/repo', token: 'token' } as any);
      scope
        .get('/repos/some/repo/contents/file.json')
        .replyWithError('some error');

      await expect(github.getJsonFile('file.json')).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
