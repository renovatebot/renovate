import * as httpMock from '../../../../test/http-mock';
import type { logger as _logger } from '../../../logger';
import type * as _git from '../../../util/git';
import { setBaseUrl } from '../../../util/http/bitbucket';
import type { Platform, PlatformResult, RepoParams } from '../types';

jest.mock('../../../util/git');
jest.mock('../../../util/host-rules');

const baseUrl = 'https://api.bitbucket.org';

const pr = {
  id: 5,
  source: { branch: { name: 'branch' } },
  destination: { branch: { name: 'master' } },
  title: 'title',
  summary: { raw: 'summary' },
  state: 'OPEN',
  created_on: '2018-07-02T07:02:25.275030+00:00',
};

describe('modules/platform/bitbucket/index', () => {
  let bitbucket: Platform;
  let hostRules: jest.Mocked<typeof import('../../../util/host-rules')>;
  let git: jest.Mocked<typeof _git>;
  let logger: jest.Mocked<typeof _logger>;

  beforeEach(async () => {
    // reset module
    jest.resetModules();
    hostRules = jest.requireMock('../../../util/host-rules');
    bitbucket = await import('.');
    logger = (await import('../../../logger')).logger as any;
    git = jest.requireMock('../../../util/git');
    git.branchExists.mockReturnValue(true);
    git.isBranchBehindBase.mockResolvedValue(false);
    // clean up hostRules
    hostRules.clear();
    hostRules.find.mockReturnValue({
      username: 'abc',
      password: '123',
    });

    setBaseUrl(baseUrl);
  });

  async function initRepoMock(
    config?: Partial<RepoParams>,
    repoResp?: any,
    existingScope?: httpMock.Scope,
  ): Promise<httpMock.Scope> {
    const repository = config?.repository ?? 'some/repo';

    const scope = existingScope ?? httpMock.scope(baseUrl);

    scope.get(`/2.0/repositories/${repository}`).reply(200, {
      owner: {},
      mainbranch: { name: 'master' },
      ...repoResp,
    });

    await bitbucket.initRepo({
      repository: 'some/repo',
      ...config,
    });

    return scope;
  }

  describe('initPlatform()', () => {
    it('should throw if no token or username/password', async () => {
      expect.assertions(1);
      await expect(bitbucket.initPlatform({})).rejects.toThrow();
    });

    it('should show warning message if custom endpoint', async () => {
      await bitbucket.initPlatform({
        endpoint: 'endpoint',
        username: 'abc',
        password: '123',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Init: Bitbucket Cloud endpoint should generally be https://api.bitbucket.org/ but is being configured to a different value. Did you mean to use Bitbucket Server?',
      );
    });

    it('should init with username/password', async () => {
      const expectedResult: PlatformResult = {
        endpoint: baseUrl,
      };
      httpMock.scope(baseUrl).get('/2.0/user').reply(200);
      expect(
        await bitbucket.initPlatform({
          endpoint: baseUrl,
          username: 'abc',
          password: '123',
        }),
      ).toEqual(expectedResult);
    });

    it('should init with only token', async () => {
      const expectedResult: PlatformResult = {
        endpoint: baseUrl,
      };
      httpMock.scope(baseUrl).get('/2.0/user').reply(200);
      expect(
        await bitbucket.initPlatform({
          endpoint: baseUrl,
          token: 'abc',
        }),
      ).toEqual(expectedResult);
    });

    it('should warn for missing "profile" scope', async () => {
      const scope = httpMock.scope(baseUrl);
      scope
        .get('/2.0/user')
        .reply(403, { error: { detail: { required: ['account'] } } });
      await bitbucket.initPlatform({ username: 'renovate', password: 'pass' });
      expect(logger.warn).toHaveBeenCalledWith(
        `Bitbucket: missing 'account' scope for password`,
      );
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories?role=contributor&pagelen=100')
        .reply(200, {
          values: [{ full_name: 'foo/bar' }, { full_name: 'some/repo' }],
        });
      const res = await bitbucket.getRepos();
      expect(res).toEqual(['foo/bar', 'some/repo']);
    });
  });

  describe('initRepo()', () => {
    it('works with username and password', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } });
      expect(
        await bitbucket.initRepo({
          repository: 'some/repo',
        }),
      ).toMatchSnapshot();
    });

    it('works with only token', async () => {
      hostRules.clear();
      hostRules.find.mockReturnValue({
        token: 'abc',
      });
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } });
      expect(
        await bitbucket.initRepo({
          repository: 'some/repo',
        }),
      ).toEqual({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint:
          '56653db0e9341ef4957c92bb78ee668b0a3f03c75b77db94d520230557385fca344cc1f593191e3594183b5b050909d29996c040045e8852f21774617b240642',
      });
    });
  });

  describe('bbUseDevelopmentBranch', () => {
    it('not enabled: defaults to using main branch', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } });

      const res = await bitbucket.initRepo({
        repository: 'some/repo',
        bbUseDevelopmentBranch: false,
      });

      expect(res.defaultBranch).toBe('master');
    });

    it('enabled: uses development branch when development branch exists', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } })
        .get('/2.0/repositories/some/repo/branching-model')
        .reply(200, {
          development: { name: 'develop', branch: { name: 'develop' } },
        });

      const res = await bitbucket.initRepo({
        repository: 'some/repo',
        bbUseDevelopmentBranch: true,
      });

      expect(res.defaultBranch).toBe('develop');
    });

    it('enabled: falls back to mainbranch if development branch does not exist', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo')
        .reply(200, { owner: {}, mainbranch: { name: 'master' } })
        .get('/2.0/repositories/some/repo/branching-model')
        .reply(200, {
          development: { name: 'develop' },
        });

      const res = await bitbucket.initRepo({
        repository: 'some/repo',
        bbUseDevelopmentBranch: true,
      });

      expect(res.defaultBranch).toBe('master');
    });
  });

  describe('getRepoForceRebase()', () => {
    it('always return false, since bitbucket does not support force rebase', async () => {
      const actual = await bitbucket.getRepoForceRebase();
      expect(actual).toBeFalse();
    });
  });

  describe('getBranchPr()', () => {
    it('bitbucket finds PR for branch', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, { values: [pr] })
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr);

      expect(await bitbucket.getBranchPr('branch')).toMatchSnapshot();
    });

    it('returns null if no PR for branch', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, { values: [pr] });

      const res = await bitbucket.getBranchPr('branch_without_pr');
      expect(res).toBeNull();
    });
  });

  describe('getBranchStatus()', () => {
    it('getBranchStatus 3', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/master')
        .reply(200, {
          name: 'master',
          target: { hash: 'master_hash' },
        })
        .get(
          '/2.0/repositories/some/repo/commit/master_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'FAILED',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('master', true)).toBe('red');
    });

    it('getBranchStatus 4', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/branch')
        .reply(200, {
          name: 'branch',
          target: {
            hash: 'branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/branch_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'renovate/stability-days',
              state: 'SUCCESSFUL',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('branch', true)).toBe('green');
    });

    it('getBranchStatus 5', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/pending/branch')
        .reply(200, {
          name: 'pending/branch',
          target: {
            hash: 'pending/branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/pending/branch_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'INPROGRESS',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('pending/branch', true)).toBe(
        'yellow',
      );
    });

    it('getBranchStatus 6', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/refs/branches/branch-with-empty-status',
        )
        .reply(200, {
          name: 'branch-with-empty-status',
          target: {
            hash: 'branch-with-empty-status',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/branch-with-empty-status/statuses?pagelen=100',
        )
        .reply(200, {
          values: [],
        });
      expect(
        await bitbucket.getBranchStatus('branch-with-empty-status', true),
      ).toBe('yellow');
    });

    it('getBranchStatus 7', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/branch')
        .reply(200, {
          name: 'branch',
          target: {
            hash: 'branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .get(
          '/2.0/repositories/some/repo/commit/branch_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'renovate/stability-days',
              state: 'SUCCESSFUL',
            },
          ],
        });
      expect(await bitbucket.getBranchStatus('branch', false)).toBe('yellow');
    });
  });

  describe('getBranchStatusCheck()', () => {
    beforeEach(async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/master')
        .reply(200, {
          name: 'master',
          target: { hash: 'master_hash' },
        })
        .get(
          '/2.0/repositories/some/repo/commit/master_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'FAILED',
            },
          ],
        });
    });

    it('getBranchStatusCheck 1', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', null)).toBeNull();
    });

    it('getBranchStatusCheck 2', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', 'foo')).toBe('red');
    });

    it('getBranchStatusCheck 3', async () => {
      expect(await bitbucket.getBranchStatusCheck('master', 'bar')).toBeNull();
    });
  });

  describe('setBranchStatus()', () => {
    it('posts status', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/branch')
        .twice()
        .reply(200, {
          name: 'branch',
          target: {
            hash: 'branch_hash',
            parents: [{ hash: 'master_hash' }],
          },
        })
        .post('/2.0/repositories/some/repo/commit/branch_hash/statuses/build')
        .reply(200)
        .get(
          '/2.0/repositories/some/repo/commit/branch_hash/statuses?pagelen=100',
        )
        .reply(200, {
          values: [
            {
              key: 'foo',
              state: 'SUCCESSFUL',
            },
          ],
        });
      await expect(
        bitbucket.setBranchStatus({
          branchName: 'branch',
          context: 'context',
          description: 'description',
          state: 'red',
          url: 'targetUrl',
        }),
      ).toResolve();
    });
  });

  describe('findIssue()', () => {
    it('does not throw', async () => {
      httpMock.scope(baseUrl).get('/2.0/user').reply(200, { uuid: '12345' });
      await bitbucket.initPlatform({ username: 'renovate', password: 'pass' });
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)%20AND%20reporter.uuid%3D%2212345%22',
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        });
      expect(await bitbucket.findIssue('title')).toMatchSnapshot();
    });

    it('returns null if no issues', async () => {
      const scope = await initRepoMock(
        {
          repository: 'some/empty',
        },
        { has_issues: true },
      );
      scope
        .get(
          '/2.0/repositories/some/empty/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, {
          values: [],
        });
      expect(await bitbucket.findIssue('title')).toBeNull();
    });
  });

  describe('ensureIssue()', () => {
    it('updates existing issues', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/25')
        .reply(200)
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({ title: 'title', body: 'body' }),
      ).toBe('updated');
    });

    it('creates new issue', async () => {
      const scope = await initRepoMock(
        { repository: 'some/empty' },
        { has_issues: true },
      );
      scope
        .get(
          '/2.0/repositories/some/empty/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, { values: [] })
        .get(
          '/2.0/repositories/some/empty/issues?q=title%3D%22old-title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, { values: [] })
        .post('/2.0/repositories/some/empty/issues')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({
          title: 'title',
          reuseTitle: 'old-title',
          body: 'body',
        }),
      ).toBe('created');
    });

    it('noop for existing issue', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      expect(
        await bitbucket.ensureIssue({
          title: 'title',
          body: '\n content \n',
        }),
      ).toBeNull();
    });
  });

  describe('ensureIssueClosing()', () => {
    it('does not throw', async () => {
      await initRepoMock();
      await expect(bitbucket.ensureIssueClosing('title')).toResolve();
    });

    it('closes issue', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get(
          '/2.0/repositories/some/repo/issues?q=title%3D%22title%22%20AND%20(state%20%3D%20%22new%22%20OR%20state%20%3D%20%22open%22)',
        )
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/issues/25')
        .reply(200)
        .put('/2.0/repositories/some/repo/issues/26')
        .reply(200);
      await expect(bitbucket.ensureIssueClosing('title')).toResolve();
    });
  });

  describe('getIssueList()', () => {
    it('has no issues', async () => {
      await initRepoMock();
      expect(await bitbucket.getIssueList()).toEqual([]);
    });

    it('get issues', async () => {
      httpMock.scope(baseUrl).get('/2.0/user').reply(200, { uuid: '12345' });
      await bitbucket.initPlatform({ username: 'renovate', password: 'pass' });
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get('/2.0/repositories/some/repo/issues')
        .query({
          q: '(state = "new" OR state = "open") AND reporter.uuid="12345"',
        })
        .reply(200, {
          values: [
            {
              id: 25,
              title: 'title',
              content: { raw: 'content' },
            },
            {
              id: 26,
              title: 'title',
              content: { raw: 'content' },
            },
          ],
        });
      const issues = await bitbucket.getIssueList();

      expect(issues).toHaveLength(2);
      expect(issues).toMatchSnapshot();
    });

    it('does not throw', async () => {
      const scope = await initRepoMock({}, { has_issues: true });
      scope
        .get('/2.0/repositories/some/repo/issues')
        .query({
          q: '(state = "new" OR state = "open")',
        })
        .reply(500, {});
      const issues = await bitbucket.getIssueList();

      expect(issues).toHaveLength(0);
    });
  });

  describe('addAssignees()', () => {
    it('does not throw', async () => {
      expect(await bitbucket.addAssignees(3, ['some'])).toMatchSnapshot();
    });
  });

  describe('addReviewers', () => {
    it('should add the given reviewers to the PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr)
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await expect(
        bitbucket.addReviewers(5, ['someuser', 'someotheruser']),
      ).toResolve();
    });

    it('should handle reviewers as username or UUID', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, pr)
        .put('/2.0/repositories/some/repo/pullrequests/5', {
          title: pr.title,
          reviewers: [
            { username: 'someuser' },
            { uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}' },
          ],
        })
        .reply(200);
      await expect(
        bitbucket.addReviewers(5, [
          'someuser',
          '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        ]),
      ).toResolve();
    });
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/undefined/pullrequests/3/comments?pagelen=100')
        .reply(500);
      expect(
        await bitbucket.ensureComment({
          number: 3,
          topic: 'topic',
          content: 'content',
        }),
      ).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/undefined/pullrequests/3/comments?pagelen=100')
        .reply(500);
      expect(
        await bitbucket.ensureCommentRemoval({
          type: 'by-topic',
          number: 3,
          topic: 'topic',
        }),
      ).toMatchSnapshot();
    });
  });

  describe('getPrList()', () => {
    it('exists', () => {
      expect(bitbucket.getPrList).toBeDefined();
    });

    it('filters PR list by author', async () => {
      const scope = httpMock.scope(baseUrl);
      scope.get('/2.0/user').reply(200, { uuid: '12345' });
      await bitbucket.initPlatform({ username: 'renovate', password: 'pass' });
      await initRepoMock(undefined, null, scope);
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&q=author.uuid="12345"&pagelen=50',
        )
        .reply(200, {
          values: [
            {
              id: 1,
              author: { uuid: '12345' },
              source: { branch: { name: 'branch-a' } },
              destination: { branch: { name: 'branch-b' } },
              state: 'OPEN',
            },
          ],
        });
      expect(await bitbucket.getPrList()).toMatchSnapshot();
    });
  });

  describe('findPr()', () => {
    it('exists', () => {
      expect(bitbucket.findPr).toBeDefined();
    });

    it('finds pr', async () => {
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, { values: [pr] });
      expect(
        await bitbucket.findPr({
          branchName: 'branch',
          prTitle: 'title',
        }),
      ).toMatchSnapshot();
    });

    it('finds closed pr with no reopen comments', async () => {
      const prComment = {
        content: {
          raw: 'some comment',
        },
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };

      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, {
          values: [
            {
              id: 5,
              source: { branch: { name: 'branch' } },
              destination: { branch: { name: 'master' } },
              title: 'title',
              state: 'closed',
            },
          ],
        })
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [prComment] });

      const pr = await bitbucket.findPr({
        branchName: 'branch',
        prTitle: 'title',
      });
      expect(pr?.number).toBe(5);
    });

    it('finds closed pr with reopen comment on private repository', async () => {
      const prComment = {
        content: {
          raw: 'reopen! comment',
        },
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
          account_id: '456',
        },
      };

      const scope = await initRepoMock({}, { is_private: true });
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, {
          values: [
            {
              id: 5,
              source: { branch: { name: 'branch' } },
              destination: { branch: { name: 'master' } },
              title: 'title',
              state: 'closed',
            },
          ],
        })
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [prComment] });

      const pr = await bitbucket.findPr({
        branchName: 'branch',
        prTitle: 'title',
      });
      expect(pr).toBeNull();
    });

    it('finds closed pr with reopen comment on public repository from workspace member', async () => {
      const workspaceMember = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };

      const prComment = {
        content: {
          raw: 'reopen! comment',
        },
        user: workspaceMember,
      };

      const scope = await initRepoMock({}, { is_private: false });
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, {
          values: [
            {
              id: 5,
              source: { branch: { name: 'branch' } },
              destination: { branch: { name: 'master' } },
              title: 'title',
              state: 'closed',
            },
          ],
        })
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [prComment] })
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(200, { values: [workspaceMember] });

      const pr = await bitbucket.findPr({
        branchName: 'branch',
        prTitle: 'title',
      });
      expect(pr).toBeNull();
    });

    it('finds closed pr with reopen comment on public repository from non-workspace member', async () => {
      const nonWorkspaceMember = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };

      const prComment = {
        content: {
          raw: 'reopen! comment',
        },
        user: nonWorkspaceMember,
      };

      const scope = await initRepoMock({}, { is_private: false });
      scope
        .get(
          '/2.0/repositories/some/repo/pullrequests?state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&pagelen=50',
        )
        .reply(200, {
          values: [
            {
              id: 5,
              source: { branch: { name: 'branch' } },
              destination: { branch: { name: 'master' } },
              title: 'title',
              state: 'closed',
            },
          ],
        })
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [prComment] })
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(404);

      const pr = await bitbucket.findPr({
        branchName: 'branch',
        prTitle: 'title',
      });
      expect(pr?.number).toBe(5);
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      const projectReviewer = {
        type: 'default_reviewer',
        reviewer_type: 'project',
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };
      const repoReviewer = {
        type: 'default_reviewer',
        reviewer_type: 'repository',
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
          account_id: '456',
        },
      };
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [projectReviewer, repoReviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('removes inactive reviewers when creating pr', async () => {
      const inactiveReviewer = {
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };
      const activeReviewerOutsideOfWorkspace = {
        user: {
          display_name: 'Alice Smith',
          uuid: '{a10e0228-ad84-11ed-afa1-0242ac120002}',
          account_id: '789',
        },
      };
      const activeReviewerWithinWorkspace = {
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
          account_id: '456',
        },
      };
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [
            activeReviewerWithinWorkspace,
            activeReviewerOutsideOfWorkspace,
            inactiveReviewer,
          ],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Malformed reviewers list'],
            },
            message: 'reviewers: Malformed reviewers list',
          },
        })
        .get('/2.0/users/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D')
        .reply(200, {
          account_status: 'active',
        })
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(200)
        .get('/2.0/users/%7Ba10e0228-ad84-11ed-afa1-0242ac120002%7D')
        .reply(200, {
          account_status: 'active',
        })
        .get(
          '/2.0/workspaces/some/members/%7Ba10e0228-ad84-11ed-afa1-0242ac120002%7D',
        )
        .reply(404)
        .get('/2.0/users/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D')
        .reply(200, {
          account_status: 'inactive',
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('removes default reviewers no longer member of the workspace when creating pr', async () => {
      const notMemberReviewer = {
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };
      const memberReviewer = {
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
          account_id: '456',
        },
      };
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [memberReviewer, notMemberReviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D',
        )
        .reply(404)
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(200)
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('throws exception when unable to check default reviewers workspace membership', async () => {
      const reviewer = {
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D',
        )
        .reply(401);
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        }),
      ).rejects.toThrow(new Error('Response code 401 (Unauthorized)'));
    });

    it('removes reviewer if they are also the author of the pr', async () => {
      const reviewers = [
        {
          user: {
            display_name: 'Bob Smith',
            uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
            account_id: '123',
          },
        },
        {
          user: {
            display_name: 'Jane Smith',
            uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
            account_id: '456',
          },
        },
      ];
      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: reviewers,
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Jane Smith is the author and cannot be included as a reviewer.',
              ],
            },
          },
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('rethrows exception when PR create error due to unknown reviewers error', async () => {
      const reviewer = {
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        },
      };

      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        }),
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });

    it('rethrows exception when PR create error not due to reviewers field', async () => {
      const reviewer = {
        user: {
          display_name: 'Jane Smith',
          uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        },
      };

      const scope = await initRepoMock();
      scope
        .get(
          '/2.0/repositories/some/repo/effective-default-reviewers?pagelen=100',
        )
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              description: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        }),
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });
  });

  describe('getPr()', () => {
    it('exists', async () => {
      const scope = await initRepoMock();
      scope.get('/2.0/repositories/some/repo/pullrequests/5').reply(200, pr);
      expect(await bitbucket.getPr(5)).toMatchSnapshot();
    });

    it('canRebase', async () => {
      expect.assertions(3);
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/3')
        .reply(200, {
          id: 3,
          source: { branch: { name: 'branch' } },
          destination: { branch: { name: 'master' } },
          title: 'title',
          summary: { raw: 'summary' },
          state: 'OPEN',
          created_on: '2018-07-02T07:02:25.275030+00:00',
        })
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .twice()
        .reply(200, pr);
      expect(await bitbucket.getPr(3)).toMatchSnapshot();

      expect(await bitbucket.getPr(5)).toMatchSnapshot();

      expect(await bitbucket.getPr(5)).toMatchSnapshot();
    });

    it('reviewers', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope.get('/2.0/repositories/some/repo/pullrequests/5').reply(200, {
        ...pr,
        reviewers: [reviewer],
      });
      expect(await bitbucket.getPr(5)).toEqual({
        bodyStruct: {
          hash: '761b7ad8ad439b2855fcbb611331c646ef0870b0631247bba3f3025cb6df5a53',
        },
        createdAt: '2018-07-02T07:02:25.275030+00:00',
        number: 5,
        reviewers: ['{90b6646d-1724-4a64-9fd9-539515fe94e9}'],
        sourceBranch: 'branch',
        state: 'open',
        targetBranch: 'master',
        title: 'title',
      });
    });
  });

  describe('massageMarkdown()', () => {
    it('returns diff files', () => {
      const prBody =
        '<details><summary>foo</summary>\n<blockquote>\n\n<details><summary>text</summary>' +
        '\n---\n\n - [ ] <!-- rebase-check --> rebase\n<!--renovate-config-hash:-->' +
        '\n\n</details>\n\n</blockquote>\n</details>';

      expect(bitbucket.massageMarkdown(prBody)).toMatchSnapshot();
    });
  });

  describe('updatePr()', () => {
    it('puts PR', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await expect(
        bitbucket.updatePr({
          number: 5,
          prTitle: 'title',
          prBody: 'body',
          targetBranch: 'new_base',
        }),
      ).toResolve();
    });

    it('removes inactive reviewers when updating pr', async () => {
      const inactiveReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const activeReviewerOutsideOfWorkspace = {
        display_name: 'Alice Smith',
        uuid: '{a10e0228-ad84-11ed-afa1-0242ac120002}',
        account_id: '789',
      };
      const activeReviewerWithinWorkspace = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, {
          reviewers: [
            activeReviewerWithinWorkspace,
            activeReviewerOutsideOfWorkspace,
            inactiveReviewer,
          ],
        })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Malformed reviewers list'],
            },
            message: 'reviewers: Malformed reviewers list',
          },
        })
        .get('/2.0/users/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D')
        .reply(200, {
          account_status: 'active',
        })
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(200)
        .get('/2.0/users/%7Ba10e0228-ad84-11ed-afa1-0242ac120002%7D')
        .reply(200, {
          account_status: 'active',
        })
        .get(
          '/2.0/workspaces/some/members/%7Ba10e0228-ad84-11ed-afa1-0242ac120002%7D',
        )
        .reply(404)
        .get('/2.0/users/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D')
        .reply(200, {
          account_status: 'inactive',
        })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await expect(
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).toResolve();
    });

    it('removes reviewers no longer member of the workspace when updating pr', async () => {
      const notMemberReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const memberReviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [memberReviewer, notMemberReviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D',
        )
        .reply(404)
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D',
        )
        .reply(200)
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);

      await expect(
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).toResolve();
    });

    it('throws exception when unable to check reviewers workspace membership', async () => {
      const reviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D',
        )
        .reply(401);
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).rejects.toThrow(new Error('Response code 401 (Unauthorized)'));
    });

    it('rethrows exception when PR update error due to unknown reviewers error', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('rethrows exception when PR create error not due to reviewers field', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              description: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });

    it('throws an error on failure to get current list of reviewers', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(500, undefined);
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('closes PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { values: [pr] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200)
        .post('/2.0/repositories/some/repo/pullrequests/5/decline')
        .reply(200);

      expect(
        await bitbucket.updatePr({
          number: pr.id,
          prTitle: pr.title,
          state: 'closed',
        }),
      ).toBeUndefined();
    });
  });

  describe('mergePr()', () => {
    it('posts Merge with optional merge strategy', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
        }),
      ).toBeTrue();
    });

    it('posts Merge with auto', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'auto',
        }),
      ).toBeTrue();
    });

    it('posts Merge with merge-commit', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'merge-commit',
        }),
      ).toBeTrue();
    });

    it('posts Merge with squash', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'squash',
        }),
      ).toBe(true);
    });

    it('does not post Merge with rebase', async () => {
      await bitbucket.mergePr({
        branchName: 'branch',
        id: 5,
        strategy: 'rebase',
      });
      expect(httpMock.getTrace()).toBeEmptyArray();
    });

    it('posts Merge with fast-forward', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'fast-forward',
        }),
      ).toBeTrue();
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/src/HEAD/file.json')
        .reply(200, JSON.stringify(data));
      const res = await bitbucket.getJsonFile('file.json');
      expect(res).toEqual(data);
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/src/HEAD/file.json5')
        .reply(200, json5Data);
      const res = await bitbucket.getJsonFile('file.json5');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns file content from given repo', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/different/repo/src/HEAD/file.json')
        .reply(200, JSON.stringify(data));
      const res = await bitbucket.getJsonFile('file.json', 'different/repo');
      expect(res).toEqual(data);
    });

    it('returns file content from branch or tag', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/src/dev/file.json')
        .reply(200, JSON.stringify(data));
      const res = await bitbucket.getJsonFile('file.json', 'some/repo', 'dev');
      expect(res).toEqual(data);
    });

    it('returns file content from branch with a slash in its name', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/refs/branches/feat/123-test')
        .reply(200, JSON.stringify({ target: { hash: '1234567890' } }));
      scope
        .get('/2.0/repositories/some/repo/src/1234567890/file.json')
        .reply(200, JSON.stringify(data));
      const res = await bitbucket.getJsonFile(
        'file.json',
        'some/repo',
        'feat/123-test',
      );
      expect(res).toEqual(data);
    });

    it('throws on malformed JSON', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/src/HEAD/file.json')
        .reply(200, '!@#');
      await expect(bitbucket.getJsonFile('file.json')).rejects.toThrow();
    });

    it('throws on errors', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/src/HEAD/file.json')
        .replyWithError('some error');
      await expect(bitbucket.getJsonFile('file.json')).rejects.toThrow();
    });
  });
});
