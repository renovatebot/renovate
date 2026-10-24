import * as httpMock from '~test/http-mock.ts';
import { git, logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_BLOCKED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages.ts';
import { toBase64 } from '../../../util/string.ts';
import * as onedev from './index.ts';
import type { Issue, Project, PullRequest, User } from './schema.ts';

const user: User = {
  id: 1,
  name: 'renovate',
};

const emails = [
  { id: 1, value: 'renovate@example.com', primary: true, ownerId: 1 },
];

const projects: Project[] = [
  {
    id: 100,
    path: 'some/repo',
    codeManagement: true,
  },
  {
    id: 101,
    path: 'other/empty',
    codeManagement: true,
  },
  {
    id: 102,
    path: 'meta/docs',
    codeManagement: false,
  },
];

const repository = 'some/repo';

const repoProject: Partial<Project> = {
  id: 100,
  path: repository,
  codeManagement: true,
};

const cloneUrl = {
  http: `https://onedev.example.com/${repository}.git`,
  ssh: `ssh://onedev.example.com/${repository}.git`,
};

function mockPullRequest(overrides?: Partial<PullRequest>): PullRequest {
  return {
    id: 5555,
    number: 1,
    title: 'PR title',
    description: 'PR body',
    sourceProjectId: 100,
    targetProjectId: 100,
    sourceBranch: 'renovate/something-1.x',
    targetBranch: 'main',
    status: 'OPEN',
    workInProgress: false,
    submitterId: 1,
    submitDate: '2024-01-01T00:00:00.000+00:00',
    ...overrides,
  };
}

function mockIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: 77,
    number: 1,
    projectId: 100,
    state: 'Open',
    title: 'Issue title',
    description: 'Issue body',
    submitDate: '2024-01-01T00:00:00.000+00:00',
    ...overrides,
  };
}

describe('modules/platform/onedev/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    onedev.resetPlatform();
    git.initRepo.mockResolvedValue();
    git.getBranchList.mockReturnValue(['main', 'dev']);
  });

  async function initFakePlatform(scope: httpMock.Scope): Promise<void> {
    scope
      .get('/users/me')
      .reply(200, user)
      .get('/users/1/email-addresses')
      .reply(200, emails);
    await onedev.initPlatform({
      token: 'renovate:abc-def',
      endpoint: 'https://onedev.example.com',
    });
  }

  function mockInitRepo(
    scope: httpMock.Scope,
    project: Partial<Project> = {},
  ): void {
    scope
      .get('/projects/ids/some/repo')
      .reply(200, '100')
      .get('/projects/100')
      .reply(200, { ...repoProject, ...project })
      .get('/projects/100/clone-url')
      .reply(200, cloneUrl);
  }

  function mockPrList(scope: httpMock.Scope, dto: PullRequest[]): void {
    scope.get('/pulls').query({ offset: 0, count: 100 }).reply(200, dto);
  }

  function mockIssueList(scope: httpMock.Scope, dto: Issue[]): void {
    scope.get('/issues').query({ offset: 0, count: 100 }).reply(200, dto);
  }

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(onedev.initPlatform({})).rejects.toThrow(
        'Init: You must configure a OneDev token in the form `username:token-or-password`',
      );
    });

    it('should throw if the token does not carry both parts', async () => {
      await expect(onedev.initPlatform({ token: 'user:' })).rejects.toThrow(
        'Init: token must be in the form `username:token-or-password`',
      );
    });

    it('should throw if auth fails', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      scope.get('/users/me').reply(500);

      await expect(
        onedev.initPlatform({ token: 'user:password' }),
      ).rejects.toThrow('Init: Authentication failure');
    });

    it('should support the default endpoint', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      scope
        .get('/users/me')
        .reply(200, user)
        .get('/users/1/email-addresses')
        .reply(200, emails);

      await expect(
        onedev.initPlatform({ token: 'renovate:abc' }),
      ).resolves.toEqual({
        endpoint: 'https://onedev.example.com/~api/',
        gitAuthor: 'renovate <renovate@example.com>',
      });
    });

    it('should accept an endpoint already ending with ~api', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      scope
        .get('/users/me')
        .reply(200, user)
        .get('/users/1/email-addresses')
        .reply(200, emails);

      await expect(
        onedev.initPlatform({
          token: 'renovate:abc',
          endpoint: 'https://onedev.example.com/~api',
        }),
      ).resolves.toEqual({
        endpoint: 'https://onedev.example.com/~api/',
        gitAuthor: 'renovate <renovate@example.com>',
      });
    });

    it('should send basic auth credentials derived from the token', async () => {
      const scope = httpMock
        .scope('https://onedev.example.com/~api')
        .matchHeader('authorization', `Basic ${toBase64('renovate:abc')}`);
      scope
        .get('/users/me')
        .reply(200, user)
        .get('/users/1/email-addresses')
        .reply(200, emails);

      await expect(
        onedev.initPlatform({
          token: 'renovate:abc',
          endpoint: 'https://onedev.example.com',
        }),
      ).resolves.toBeDefined();
    });

    it('should use the username parameter when the token has no colon', async () => {
      const scope = httpMock
        .scope('https://onedev.example.com/~api')
        .matchHeader('authorization', `Basic ${toBase64('someuser:abc')}`);
      scope
        .get('/users/me')
        .reply(200, user)
        .get('/users/1/email-addresses')
        .reply(200, emails);

      await expect(
        onedev.initPlatform({
          token: 'abc',
          username: 'someuser',
          endpoint: 'https://onedev.example.com',
        }),
      ).resolves.toBeDefined();
    });

    it('should return no gitAuthor when the user has no email', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      scope
        .get('/users/me')
        .reply(200, user)
        .get('/users/1/email-addresses')
        .reply(200, []);

      await expect(
        onedev.initPlatform({
          token: 'renovate:abc',
          endpoint: 'https://onedev.example.com',
        }),
      ).resolves.toEqual({
        endpoint: 'https://onedev.example.com/~api/',
        gitAuthor: undefined,
      });

      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('getRepos()', () => {
    it('returns projects with code management only', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      scope
        .get('/projects')
        .query({ offset: 0, count: 100 })
        .reply(200, projects);

      await expect(onedev.getRepos()).resolves.toEqual([
        'some/repo',
        'other/empty',
      ]);
    });

    it('honors namespaces filters', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      scope
        .get('/projects')
        .query({ offset: 0, count: 100 })
        .reply(200, projects);

      await expect(onedev.getRepos({ namespaces: ['other'] })).resolves.toEqual(
        ['other/empty'],
      );
    });

    it('paginates the project list', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      const firstPage = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        path: `page1/repo-${i}`,
        codeManagement: true,
      }));
      scope
        .get('/projects')
        .query({ offset: 0, count: 100 })
        .reply(200, firstPage)
        .get('/projects')
        .query({ offset: 100, count: 100 })
        .reply(200, [{ ...repoProject, id: 999, path: 'page2/repo' }]);

      await expect(onedev.getRepos()).resolves.toContain('page2/repo');
    });
  });

  describe('initRepo()', () => {
    it('initializes the repository with the http clone url', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);

      await expect(onedev.initRepo({ repository })).resolves.toMatchObject({
        defaultBranch: 'main',
        isFork: false,
      });
      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://renovate:abc-def@onedev.example.com/some/repo.git',
        }),
      );
    });

    it('uses the ssh clone url when requested', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);

      await onedev.initRepo({ repository, gitUrl: 'ssh' });

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({ url: cloneUrl.ssh }),
      );
    });

    it('builds the git url from the endpoint when requested', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);

      await onedev.initRepo({ repository, gitUrl: 'endpoint' });

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://renovate:abc-def@onedev.example.com/some/repo.git',
        }),
      );
    });

    it('falls back to the master branch', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      git.getBranchList.mockReturnValue(['master', 'dev']);

      await expect(onedev.initRepo({ repository })).resolves.toMatchObject({
        defaultBranch: 'master',
      });
    });

    it('throws on unreachable projects', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      scope.get('/projects/ids/some/repo').reply(404);

      await expect(onedev.initRepo({ repository })).rejects.toThrow(
        REPOSITORY_NOT_FOUND,
      );
    });

    it('throws on forbidden projects', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      scope.get('/projects/ids/some/repo').reply(403);

      await expect(onedev.initRepo({ repository })).rejects.toThrow(
        REPOSITORY_ACCESS_FORBIDDEN,
      );
    });

    it('throws when code management is disabled', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      scope
        .get('/projects/ids/meta/docs')
        .reply(200, '102')
        .get('/projects/102')
        .reply(200, {
          id: 102,
          path: 'meta/docs',
          codeManagement: false,
        });

      await expect(
        onedev.initRepo({ repository: 'meta/docs' }),
      ).rejects.toThrow(REPOSITORY_BLOCKED);
    });

    it('throws when the repository has no branches', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      git.getBranchList.mockReturnValue([]);

      await expect(onedev.initRepo({ repository })).rejects.toThrow(
        REPOSITORY_EMPTY,
      );
    });
  });

  describe('getPrList', () => {
    it('maps pull requests of the project', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [
        mockPullRequest(),
        mockPullRequest({ id: 5556, number: 2, status: 'MERGED' }),
        mockPullRequest({ id: 5557, number: 3, targetProjectId: 200 }),
      ]);

      const prList = await onedev.getPrList();
      expect(prList).toHaveLength(2);
      expect(prList).toEqual([
        {
          number: 1,
          state: 'open',
          title: 'PR title',
          bodyStruct: expect.objectContaining({
            hash: expect.stringContaining(''),
          }),
          sourceBranch: 'renovate/something-1.x',
          targetBranch: 'main',
          createdAt: '2024-01-01T00:00:00.000+00:00',
          closedAt: undefined,
          isDraft: false,
        },
        {
          number: 2,
          state: 'merged',
          title: 'PR title',
          bodyStruct: expect.objectContaining({
            hash: expect.stringContaining(''),
          }),
          sourceBranch: 'renovate/something-1.x',
          targetBranch: 'main',
          createdAt: '2024-01-01T00:00:00.000+00:00',
          closedAt: undefined,
          isDraft: false,
        },
      ]);
    });

    it('hides pull requests from other authors', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [
        mockPullRequest(),
        mockPullRequest({ submitterId: 2, sourceBranch: 'feature/other' }),
        mockPullRequest({
          id: 5557,
          number: 3,
          submitterId: 2,
          sourceBranch: 'renovate/rebase-x',
        }),
      ]);

      const prList = await onedev.getPrList();
      expect(prList.map((pr) => pr.number)).toEqual([1, 3]);
    });

    it('supports draft PRs', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest({ workInProgress: true })]);

      const prList = await onedev.getPrList();
      expect(prList[0].isDraft).toBeTrue();
    });
  });

  describe('findPr/getPr', () => {
    it('finds and returns PRs of the project', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [
        mockPullRequest(),
        mockPullRequest({ id: 5556, number: 2, status: 'DISCARDED' }),
      ]);

      await expect(
        onedev.findPr({ branchName: 'renovate/something-1.x', state: 'open' }),
      ).resolves.toMatchObject({ number: 1, state: 'open' });

      await expect(
        onedev.findPr({
          branchName: 'renovate/something-1.x',
          state: 'closed',
          prTitle: 'PR title',
        }),
      ).resolves.toMatchObject({ number: 2, state: 'closed' });

      await expect(
        onedev.findPr({ branchName: 'renovate/something-1.x', state: 'all' }),
      ).resolves.toMatchObject({ number: 1 });

      await expect(onedev.getPr(99)).resolves.toBeNull();
    });

    it('returns the branch PR', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);

      await expect(
        onedev.getBranchPr('renovate/something-1.x'),
      ).resolves.toMatchObject({ number: 1 });
    });
  });

  describe('createPr()', () => {
    it('creates a pull request and locates it afterwards', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      scope
        .post('/pulls', {
          targetProjectId: 100,
          sourceProjectId: 100,
          targetBranch: 'main',
          sourceBranch: 'renovate/new-branch',
          title: 'PR title',
          description: 'PR body',
          workInProgress: false,
        })
        .reply(200, '5555')
        .get('/pulls')
        .query({ offset: 0, count: 100 })
        .reply(200, [mockPullRequest({ sourceBranch: 'renovate/new-branch' })]);

      await expect(
        onedev.createPr({
          sourceBranch: 'renovate/new-branch',
          targetBranch: 'main',
          prTitle: 'PR title',
          prBody: 'PR body',
        }),
      ).resolves.toMatchObject({
        number: 1,
        sourceBranch: 'renovate/new-branch',
      });
    });

    it('creates draft pull requests as work in progress', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      scope
        .post('/pulls', (body) => body.workInProgress === true)
        .reply(200, '5555')
        .get('/pulls')
        .query({ offset: 0, count: 100 })
        .reply(200, [mockPullRequest({ workInProgress: true })]);

      await expect(
        onedev.createPr({
          sourceBranch: 'renovate/new-branch',
          targetBranch: 'main',
          prTitle: 'PR title',
          prBody: 'PR body',
          draftPR: true,
        }),
      ).resolves.toMatchObject({ number: 1, isDraft: true });
    });

    it('enables platform native automerge', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      scope
        .post('/pulls')
        .reply(200, '5555')
        .post('/pulls/5555/merge-strategy', '"SQUASH_SOURCE_BRANCH_COMMITS"')
        .reply(200)
        .post('/pulls/5555/auto-merge', {
          commitMessage: 'automerge!',
          enabled: true,
        })
        .reply(200)
        .get('/pulls')
        .query({ offset: 0, count: 100 })
        .reply(200, [mockPullRequest({ sourceBranch: 'renovate/new-branch' })]);

      await expect(
        onedev.createPr({
          sourceBranch: 'renovate/new-branch',
          targetBranch: 'main',
          prTitle: 'PR title',
          prBody: 'PR body',
          platformPrOptions: {
            usePlatformAutomerge: true,
            automergeStrategy: 'squash',
            automergeCommitMessage: 'automerge!',
          },
        }),
      ).resolves.toMatchObject({ number: 1 });
    });

    it('reuses an open PR when creation fails', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      scope
        .post('/pulls')
        .reply(500)
        .get('/pulls')
        .query({ offset: 0, count: 100 })
        .reply(200, [mockPullRequest({ sourceBranch: 'renovate/new-branch' })]);

      await expect(
        onedev.createPr({
          sourceBranch: 'renovate/new-branch',
          targetBranch: 'main',
          prTitle: 'PR title',
          prBody: 'PR body',
        }),
      ).resolves.toMatchObject({ number: 1 });
    });

    it('rethrows when creation fails and no PR exists', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      scope
        .post('/pulls')
        .reply(500)
        .get('/pulls')
        .query({ offset: 0, count: 100 })
        .reply(200, []);

      await expect(
        onedev.createPr({
          sourceBranch: 'renovate/new-branch',
          targetBranch: 'main',
          prTitle: 'PR title',
          prBody: 'PR body',
        }),
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('updatePr()', () => {
    it('updates the title and description', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .post('/pulls/5555/title', '"new title"')
        .reply(200)
        .post('/pulls/5555/description', '"new description"')
        .reply(200);

      await expect(
        onedev.updatePr({
          number: 1,
          prTitle: 'new title',
          prBody: 'new description',
        }),
      ).toResolve();
    });

    it('discards and reopens the PR', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .post('/pulls/5555/title', '"PR title"')
        .reply(200)
        .post('/pulls/5555/discard')
        .reply(200);

      await expect(
        onedev.updatePr({
          number: 1,
          prTitle: 'PR title',
          state: 'closed',
        }),
      ).toResolve();

      mockPrList(scope, [mockPullRequest()]);
      scope
        .post('/pulls/5555/title', '"PR title"')
        .reply(200)
        .post('/pulls/5555/reopen')
        .reply(200);

      await expect(
        onedev.updatePr({ number: 1, prTitle: 'PR title', state: 'open' }),
      ).toResolve();
    });

    it('does nothing for unknown PR numbers', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);

      await onedev.updatePr({ number: 99, prTitle: 'new title' });
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('mergePr()', () => {
    it('merges without an explicit strategy', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope.post('/pulls/5555/merge').reply(200);

      await expect(onedev.mergePr({ id: 1 })).resolves.toBeTrue();
    });

    it('sets the strategy before merging', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .post('/pulls/5555/merge-strategy', '"SQUASH_SOURCE_BRANCH_COMMITS"')
        .reply(200)
        .post('/pulls/5555/merge')
        .reply(200);

      await expect(
        onedev.mergePr({ id: 1, strategy: 'squash' }),
      ).resolves.toBeTrue();
    });

    it('returns false on failing merges', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope.post('/pulls/5555/merge').reply(500);

      await expect(onedev.mergePr({ id: 1 })).resolves.toBeFalse();
    });

    it('returns false for unknown PR numbers', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);

      await expect(onedev.mergePr({ id: 99 })).resolves.toBeFalse();
    });
  });

  describe('getBranchStatus()', () => {
    function buildStatuses(status: string) {
      return [{ id: 1, projectId: 100, jobName: 'build', status }];
    }

    it('returns yellow when no open PR exists', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, []);

      await expect(
        onedev.getBranchStatus('renovate/nothing', true),
      ).resolves.toBe('yellow');
    });

    it('maps build statuses', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);

      scope
        .get('/pulls/5555/current-builds')
        .reply(200, buildStatuses('SUCCESSFUL'));
      await expect(
        onedev.getBranchStatus('renovate/something-1.x', true),
      ).resolves.toBe('green');

      scope
        .get('/pulls/5555/current-builds')
        .reply(200, buildStatuses('FAILED'));
      await expect(
        onedev.getBranchStatus('renovate/something-1.x', true),
      ).resolves.toBe('red');

      scope
        .get('/pulls/5555/current-builds')
        .reply(200, buildStatuses('RUNNING'));
      await expect(
        onedev.getBranchStatus('renovate/something-1.x', true),
      ).resolves.toBe('yellow');

      scope.get('/pulls/5555/current-builds').reply(200, []);
      await expect(
        onedev.getBranchStatus('renovate/something-1.x', true),
      ).resolves.toBe('yellow');

      scope.get('/pulls/5555/current-builds').reply(500);
      await expect(
        onedev.getBranchStatus('renovate/something-1.x', true),
      ).resolves.toBe('yellow');
    });
  });

  describe('branch status stubs', () => {
    it('handles unsupported status operations', async () => {
      await onedev.setBranchStatus({
        branchName: 'some/branch',
        context: 'ctx',
        description: 'des',
        state: 'green',
      });
      await expect(onedev.getBranchStatusCheck('b', 'ctx')).resolves.toBeNull();
    });
  });

  describe('issues', () => {
    it('lists project issues and maps states', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue(),
        mockIssue({ id: 78, number: 2, state: 'Closed' }),
        mockIssue({ id: 79, number: 3, projectId: 200 }),
      ]);

      const issueList = await onedev.getIssueList();
      expect(issueList).toEqual([
        {
          number: 1,
          state: 'open',
          title: 'Issue title',
          body: 'Issue body',
          createdAt: '2024-01-01T00:00:00.000+00:00',
        },
        {
          number: 2,
          state: 'closed',
          title: 'Issue title',
          body: 'Issue body',
          createdAt: '2024-01-01T00:00:00.000+00:00',
        },
      ]);
    });

    it('finds open issues by title', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [mockIssue(), mockIssue({ state: 'Closed' })]);

      await expect(onedev.findIssue('Issue title')).resolves.toMatchObject({
        number: 1,
        state: 'open',
      });
      await expect(onedev.findIssue('Unknown')).resolves.toBeNull();
    });

    it('creates missing issues', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, []);
      scope
        .post('/issues', {
          projectId: 100,
          title: 'Dependency dashboard',
          description: 'blurb',
          confidential: false,
        })
        .reply(200, '88');

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'blurb',
        }),
      ).resolves.toBe('created');
    });

    it('creates confidential issues when requested', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, []);
      scope
        .post('/issues', {
          projectId: 100,
          title: 'Dependency dashboard',
          description: 'blurb',
          confidential: true,
        })
        .reply(200, '88');

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'blurb',
          confidential: true,
        }),
      ).resolves.toBe('created');
    });

    it('updates changed issue bodies', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [mockIssue({ title: 'Dependency dashboard' })]);
      scope.post('/issues/77/description', '"new blurb"').reply(200);

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'new blurb',
        }),
      ).resolves.toBe('updated');
    });

    it('skips up-to-date issues', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue({ title: 'Dependency dashboard', description: 'blurb' }),
      ]);

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'blurb',
        }),
      ).resolves.toBeNull();
    });

    it('skips closed issues with once', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue({ title: 'Dependency dashboard', state: 'Closed' }),
      ]);

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'blurb',
          once: true,
        }),
      ).resolves.toBeNull();
    });

    it('reopens closed issues', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue({ title: 'Dependency dashboard', state: 'Closed' }),
      ]);
      scope
        .post('/issues/77/description', '"blurb"')
        .reply(200)
        .post('/issues/77/state-transitions', { state: 'Open', comment: '' })
        .reply(200);

      await expect(
        onedev.ensureIssue({
          title: 'Dependency dashboard',
          body: 'blurb',
          shouldReOpen: true,
        }),
      ).resolves.toBe('updated');
    });

    it('closes issues on demand', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue({ title: 'Dependency dashboard', description: 'blurb' }),
      ]);
      scope
        .post('/issues/77/state-transitions', { state: 'Closed', comment: '' })
        .reply(200);

      await expect(
        onedev.ensureIssueClosing('Dependency dashboard'),
      ).toResolve();
    });

    it('does not fail when closing fails', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockIssueList(scope, [
        mockIssue({ title: 'Dependency dashboard', description: 'blurb' }),
      ]);
      scope.post('/issues/77/state-transitions').reply(404);

      await onedev.ensureIssueClosing('Dependency dashboard');
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('comments', () => {
    it('returns false for PR comments', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });

      await expect(
        onedev.ensureComment({
          number: 1,
          topic: 'topic',
          content: 'content',
        }),
      ).resolves.toBeFalse();

      await onedev.ensureCommentRemoval({
        type: 'by-topic',
        number: 1,
        topic: 'topic',
      });
    });
  });

  describe('reviewers and assignees', () => {
    it('adds reviewers', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .get('/users/ids/someuser')
        .reply(200, '5')
        .post('/pulls/5555/reviewers/5')
        .reply(200);

      await expect(onedev.addReviewers(1, ['someuser'])).toResolve();
    });

    it('adds assignees', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .get('/users/ids/someuser')
        .reply(200, '5')
        .post('/pulls/5555/assignees/5')
        .reply(200);

      await expect(onedev.addAssignees(1, ['someuser'])).toResolve();
    });

    it('skips unknown users', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });
      mockPrList(scope, [mockPullRequest()]);
      scope
        .get('/users/ids/unknown')
        .reply(404)
        .get('/users/ids/known')
        .reply(200, '6')
        .post('/pulls/5555/reviewers/6')
        .reply(200);

      await onedev.addReviewers(1, ['unknown', 'known']);
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('files', () => {
    it('returns no files over REST', async () => {
      const scope = httpMock.scope('https://onedev.example.com/~api');
      await initFakePlatform(scope);
      mockInitRepo(scope);
      await onedev.initRepo({ repository });

      await expect(onedev.getRawFile('renovate.json')).resolves.toBeNull();
      await expect(onedev.getJsonFile('renovate.json')).resolves.toBeNull();
    });
  });

  describe('massageMarkdown()', () => {
    it('truncates overly long bodies', () => {
      const longBody = 'a'.repeat(onedev.maxBodyLength() + 1);
      expect(onedev.massageMarkdown(longBody).length).toBeLessThan(
        longBody.length,
      );
      expect(onedev.massageMarkdown('short body')).toBe('short body');
    });
  });
});
