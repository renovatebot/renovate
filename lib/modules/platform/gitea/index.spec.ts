import type { EnsureIssueConfig, Platform, RepoParams } from '..';
import * as httpMock from '../../../../test/http-mock';
import { mocked, partial } from '../../../../test/util';
import {
  CONFIG_GIT_URL_UNAVAILABLE,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../../constants/error-messages';
import type { logger as _logger } from '../../../logger';
import type * as _git from '../../../util/git';
import type { LongCommitSha } from '../../../util/git/types';
import { setBaseUrl } from '../../../util/http/gitea';
import type {
  Comment,
  CommitStatus,
  CommitStatusType,
  Issue,
  Label,
  PR,
  Repo,
  User,
} from './types';

jest.mock('../../../util/git');

/**
 * latest tested gitea version.
 */
const GITEA_VERSION = '1.14.0+dev-754-g5d2b7ba63';

describe('modules/platform/gitea/index', () => {
  let gitea: Platform;
  let logger: jest.Mocked<typeof _logger>;
  let git: jest.Mocked<typeof _git>;
  let hostRules: typeof import('../../../util/host-rules');
  let memCache: typeof import('../../../util/cache/memory');

  const mockCommitHash =
    '0d9c7726c3d628b7e28af234595cfd20febdbf8e' as LongCommitSha;

  const mockUser: User = {
    id: 1,
    username: 'renovate',
    full_name: 'Renovate Bot',
    email: 'renovate@example.com',
  };

  const mockRepo = partial<Repo>({
    allow_rebase: true,
    clone_url: 'https://gitea.renovatebot.com/some/repo.git',
    ssh_url: 'git@gitea.renovatebot.com/some/repo.git',
    default_branch: 'master',
    full_name: 'some/repo',
    permissions: {
      pull: true,
      push: true,
      admin: false,
    },
  });

  type MockPr = PR & Required<Pick<PR, 'head' | 'base'>>;

  const mockRepos: Repo[] = [
    partial<Repo>({ full_name: 'a/b' }),
    partial<Repo>({ full_name: 'c/d' }),
    partial<Repo>({ full_name: 'e/f', mirror: true }),
  ];

  const mockTopicRepos: Repo[] = [partial<Repo>({ full_name: 'a/b' })];

  const mockNamespaceRepos: Repo[] = [
    partial<Repo>({ full_name: 'org1/repo' }),
    partial<Repo>({ full_name: 'org2/repo' }),
    partial<Repo>({ full_name: 'org2/repo2', archived: true }),
  ];

  const mockPRs: MockPr[] = [
    partial<MockPr>({
      number: 1,
      title: 'Some PR',
      body: 'some random pull request',
      state: 'open',
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/1.diff',
      created_at: '2015-03-22T20:36:16Z',
      closed_at: '2015-03-22T21:36:16Z',
      updated_at: '2015-03-22T21:36:16Z',
      mergeable: true,
      base: { ref: 'some-base-branch' },
      head: {
        label: 'some-head-branch',
        sha: 'some-head-sha' as LongCommitSha,
        repo: partial<Repo>({ full_name: mockRepo.full_name }),
      },
    }),
    partial<MockPr>({
      number: 2,
      title: 'Other PR',
      body: 'other random pull request',
      state: 'closed',
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/2.diff',
      created_at: '2011-08-18T22:30:38Z',
      closed_at: '2016-01-09T10:03:21Z',
      updated_at: '2016-01-09T10:03:21Z',
      mergeable: true,
      base: { ref: 'other-base-branch' },
      head: {
        label: 'other-head-branch',
        sha: 'other-head-sha' as LongCommitSha,
        repo: partial<Repo>({ full_name: mockRepo.full_name }),
      },
      labels: [
        {
          id: 1,
          name: 'bug',
        },
      ],
    }),
    partial<MockPr>({
      number: 3,
      title: 'WIP: Draft PR',
      body: 'other random pull request',
      state: 'open',
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/3.diff',
      created_at: '2011-08-18T22:30:39Z',
      closed_at: '2016-01-09T10:03:22Z',
      updated_at: '2017-01-09T10:03:22Z',
      mergeable: false,
      base: { ref: 'draft-base-branch' },
      head: {
        label: 'draft-head-branch',
        sha: 'draft-head-sha' as LongCommitSha,
        repo: partial<Repo>({ full_name: mockRepo.full_name }),
      },
    }),
  ];

  const mockIssues: Issue[] = [
    {
      number: 1,
      title: 'open-issue',
      state: 'open',
      body: 'some-content',
      assignees: [],
      labels: [],
    },
    {
      number: 2,
      title: 'closed-issue',
      state: 'closed',
      body: 'other-content',
      assignees: [],
      labels: undefined as never, // coverage
    },
    {
      number: 3,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
      labels: [],
    },
    {
      number: 4,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
      labels: [],
    },
    {
      number: 5,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
      labels: [],
    },
  ];

  const mockComments: Comment[] = [
    { id: 11, body: 'some-body' },
    { id: 12, body: 'other-body' },
    { id: 13, body: '### some-topic\n\nsome-content' },
  ];

  const mockRepoLabels: Label[] = [
    { id: 1, name: 'some-label', description: 'its a me', color: '#000000' },
    { id: 2, name: 'other-label', description: 'labelario', color: '#ffffff' },
  ];

  const mockOrgLabels: Label[] = [
    {
      id: 3,
      name: 'some-org-label',
      description: 'its a org me',
      color: '#0000aa',
    },
    {
      id: 4,
      name: 'other-org-label',
      description: 'org labelario',
      color: '#ffffaa',
    },
  ];

  beforeEach(async () => {
    jest.resetModules();

    memCache = await import('../../../util/cache/memory');
    gitea = await import('.');
    logger = mocked(await import('../../../logger')).logger;
    git = jest.requireMock('../../../util/git');
    git.isBranchBehindBase.mockResolvedValue(false);
    git.getBranchCommit.mockReturnValue(mockCommitHash);
    hostRules = await import('../../../util/host-rules');
    hostRules.clear();

    setBaseUrl('https://gitea.renovatebot.com/');

    delete process.env.RENOVATE_X_AUTODISCOVER_REPO_SORT;
    delete process.env.RENOVATE_X_AUTODISCOVER_REPO_ORDER;
  });

  async function initFakePlatform(
    scope: httpMock.Scope,
    version = GITEA_VERSION,
  ): Promise<void> {
    scope
      .get('/user')
      .reply(200, mockUser)
      .get('/version')
      .reply(200, { version });
    await gitea.initPlatform({ token: 'abc' });
  }

  async function initFakeRepo(
    scope: httpMock.Scope,
    repo?: Partial<Repo>,
    config?: Partial<RepoParams>,
  ): Promise<void> {
    const repoResult = { ...mockRepo, ...repo };
    const repository = repoResult.full_name;
    scope.get(`/repos/${repository}`).reply(200, repoResult);
    await gitea.initRepo({ repository, ...config });
  }

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(gitea.initPlatform({})).rejects.toThrow();
    });

    it('should throw if auth fails', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      scope.get('/user').reply(500);

      await expect(
        gitea.initPlatform({ token: 'some-token' }),
      ).rejects.toThrow();
    });

    it('should support default endpoint', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      scope
        .get('/user')
        .reply(200, mockUser)
        .get('/version')
        .reply(200, { version: GITEA_VERSION });

      expect(await gitea.initPlatform({ token: 'some-token' })).toEqual({
        endpoint: 'https://gitea.com/',
        gitAuthor: 'Renovate Bot <renovate@example.com>',
      });
    });

    it('should support custom endpoint', async () => {
      const scope = httpMock.scope('https://gitea.renovatebot.com/api/v1');
      scope
        .get('/user')
        .reply(200, mockUser)
        .get('/version')
        .reply(200, { version: GITEA_VERSION });

      expect(
        await gitea.initPlatform({
          token: 'some-token',
          endpoint: 'https://gitea.renovatebot.com',
        }),
      ).toEqual({
        endpoint: 'https://gitea.renovatebot.com/',
        gitAuthor: 'Renovate Bot <renovate@example.com>',
      });
    });

    it('should support custom endpoint including api path', async () => {
      const scope = httpMock.scope('https://gitea.renovatebot.com/api/v1');
      scope
        .get('/user')
        .reply(200, mockUser)
        .get('/version')
        .reply(200, { version: GITEA_VERSION });

      expect(
        await gitea.initPlatform({
          token: 'some-token',
          endpoint: 'https://gitea.renovatebot.com',
        }),
      ).toEqual({
        endpoint: 'https://gitea.renovatebot.com/',
        gitAuthor: 'Renovate Bot <renovate@example.com>',
      });
    });

    it('should use username as author name if full name is missing', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      scope
        .get('/user')
        .reply(200, {
          ...mockUser,
          full_name: undefined,
        })
        .get('/version')
        .reply(200, { version: GITEA_VERSION });

      expect(await gitea.initPlatform({ token: 'some-token' })).toEqual({
        endpoint: 'https://gitea.com/',
        gitAuthor: 'renovate <renovate@example.com>',
      });
    });
  });

  describe('getRepos', () => {
    it('should propagate any other errors', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/search')
        .query({
          uid: 1,
          archived: false,
        })
        .replyWithError(new Error('searchRepos()'));
      await initFakePlatform(scope);

      await expect(gitea.getRepos()).rejects.toThrow('searchRepos()');
    });

    it('should return an array of repos', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/search')
        .query({
          uid: 1,
          archived: false,
        })
        .reply(200, {
          ok: true,
          data: mockRepos,
        });
      await initFakePlatform(scope);

      const repos = await gitea.getRepos();
      expect(repos).toEqual(['a/b', 'c/d']);
    });

    it('should return an filtered array of repos', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');

      scope
        .get('/repos/search')
        .query({
          uid: 1,
          archived: false,
          q: 'renovate',
          topic: true,
        })
        .reply(200, {
          ok: true,
          data: mockTopicRepos,
        });

      scope
        .get('/repos/search')
        .query({
          uid: 1,
          archived: false,
          q: 'renovatebot',
          topic: true,
        })
        .reply(200, {
          ok: true,
          data: mockTopicRepos,
        });

      await initFakePlatform(scope);

      const repos = await gitea.getRepos({
        topics: ['renovate', 'renovatebot'],
      });
      expect(repos).toEqual(['a/b']);
    });

    it('should query the organization endpoint for each namespace', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');

      scope.get('/orgs/org1/repos').reply(200, mockNamespaceRepos);
      scope.get('/orgs/org2/repos').reply(200, mockNamespaceRepos);

      await initFakePlatform(scope);

      const repos = await gitea.getRepos({
        namespaces: ['org1', 'org2'],
      });
      expect(repos).toEqual(['org1/repo', 'org2/repo']);
    });

    it('Sorts repos', async () => {
      process.env.RENOVATE_X_AUTODISCOVER_REPO_SORT = 'updated';
      process.env.RENOVATE_X_AUTODISCOVER_REPO_ORDER = 'desc';
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/search')
        .query({
          uid: 1,
          archived: false,
          sort: 'updated',
          order: 'desc',
        })
        .reply(200, {
          ok: true,
          data: mockRepos,
        });
      await initFakePlatform(scope);

      const repos = await gitea.getRepos();
      expect(repos).toEqual(['a/b', 'c/d']);
    });
  });

  describe('initRepo', () => {
    const initRepoCfg: RepoParams = {
      repository: mockRepo.full_name,
    };

    it('should propagate API errors', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .replyWithError(new Error('getRepo()'));
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow('getRepo()');
    });

    it('should abort when repo is archived', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          archived: true,
        });
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow(
        REPOSITORY_ARCHIVED,
      );
    });

    it('should abort when repo is mirrored', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          mirror: true,
        });
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow(
        REPOSITORY_MIRRORED,
      );
    });

    it('should abort when repo is empty', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          empty: true,
        });
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow(
        REPOSITORY_EMPTY,
      );
    });

    it('should abort when repo has insufficient permissions', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          permissions: {
            pull: false,
            push: false,
            admin: false,
          },
        });
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow(
        REPOSITORY_ACCESS_FORBIDDEN,
      );
    });

    it('should abort when repo has no available merge methods', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          allow_rebase: false,
        });
      await initFakePlatform(scope);
      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow(
        REPOSITORY_BLOCKED,
      );
    });

    it('should fall back to merge method "rebase-merge"', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          allow_rebase: false,
          allow_rebase_explicit: true,
        });
      await initFakePlatform(scope);

      await gitea.initRepo(initRepoCfg);

      expect(git.initRepo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          mergeMethod: 'rebase-merge',
        }),
      );
    });

    it('should fall back to merge method "squash"', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          allow_rebase: false,
          allow_squash_merge: true,
        });
      await initFakePlatform(scope);

      await gitea.initRepo(initRepoCfg);

      expect(git.initRepo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          mergeMethod: 'squash',
        }),
      );
    });

    it('should fall back to merge method "merge"', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          allow_rebase: false,
          allow_merge_commits: true,
        });
      await initFakePlatform(scope);

      await gitea.initRepo(initRepoCfg);

      expect(git.initRepo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          mergeMethod: 'merge',
        }),
      );
    });

    it('should use clone_url of repo if gitUrl is not specified', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
      };
      await gitea.initRepo(repoCfg);

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({ url: mockRepo.clone_url }),
      );
    });

    it('should use clone_url of repo if gitUrl has value default', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
        gitUrl: 'default',
      };
      await gitea.initRepo(repoCfg);

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({ url: mockRepo.clone_url }),
      );
    });

    it('should use ssh_url of repo if gitUrl has value ssh', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
        gitUrl: 'ssh',
      };
      await gitea.initRepo(repoCfg);

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({ url: mockRepo.ssh_url }),
      );
    });

    it('should abort when gitUrl has value ssh but ssh_url is empty', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, { ...mockRepo, ssh_url: undefined });
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
        gitUrl: 'ssh',
      };

      await expect(gitea.initRepo(repoCfg)).rejects.toThrow(
        CONFIG_GIT_URL_UNAVAILABLE,
      );
    });

    it('should use generated url of repo if gitUrl has value endpoint', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
        gitUrl: 'endpoint',
      };
      await gitea.initRepo(repoCfg);

      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://gitea.com/${mockRepo.full_name}.git`,
        }),
      );
    });

    it('should abort when clone_url is empty', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          clone_url: undefined,
        });
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
      };

      await expect(gitea.initRepo(repoCfg)).rejects.toThrow(
        CONFIG_GIT_URL_UNAVAILABLE,
      );
    });

    it('should use given access token if gitUrl has value endpoint', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const token = 'abc';
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'https://gitea.com/',
        token,
      });

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
        gitUrl: 'endpoint',
      };
      await gitea.initRepo(repoCfg);

      const url = new URL(`${mockRepo.clone_url}`);
      url.username = token;
      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://${token}@gitea.com/${mockRepo.full_name}.git`,
        }),
      );
    });

    it('should use given access token if gitUrl is not specified', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, mockRepo);
      await initFakePlatform(scope);

      const token = 'abc';
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'https://gitea.com/',
        token,
      });

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
      };
      await gitea.initRepo(repoCfg);

      const url = new URL(`${mockRepo.clone_url}`);
      url.username = token;
      expect(git.initRepo).toHaveBeenCalledWith(
        expect.objectContaining({ url: url.toString() }),
      );
    });

    it('should abort when clone_url is not valid', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get(`/repos/${initRepoCfg.repository}`)
        .reply(200, {
          ...mockRepo,
          clone_url: 'abc',
        });
      await initFakePlatform(scope);

      const repoCfg: RepoParams = {
        repository: mockRepo.full_name,
      };

      await expect(gitea.initRepo(repoCfg)).rejects.toThrow(
        CONFIG_GIT_URL_UNAVAILABLE,
      );
    });
  });

  describe('setBranchStatus', () => {
    it('should create a new commit status', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post(
          '/repos/some/repo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e',
          {
            state: 'success',
            context: 'some-context',
            description: 'some-description',
          },
        )
        .reply(200)
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, []);

      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.setBranchStatus({
          branchName: 'some-branch',
          state: 'green',
          context: 'some-context',
          description: 'some-description',
        }),
      ).toResolve();
    });

    it('should default to pending state', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post(
          '/repos/some/repo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e',
          {
            state: 'pending',
            context: 'some-context',
            description: 'some-description',
          },
        )
        .reply(200)
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, []);

      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.setBranchStatus({
          branchName: 'some-branch',
          context: 'some-context',
          description: 'some-description',
          state: undefined as never,
        }),
      ).toResolve();
    });

    it('should include url if specified', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post(
          '/repos/some/repo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e',
          {
            state: 'success',
            context: 'some-context',
            description: 'some-description',
            target_url: 'some-url',
          },
        )
        .reply(200)
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, []);

      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.setBranchStatus({
          branchName: 'some-branch',
          state: 'green',
          context: 'some-context',
          description: 'some-description',
          url: 'some-url',
        }),
      ).toResolve();
    });

    it('should gracefully fail with warning', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post(
          '/repos/some/repo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e',
        )
        .replyWithError('unknown error');

      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.setBranchStatus({
          branchName: 'some-branch',
          state: 'green',
          context: 'some-context',
          description: 'some-description',
        }),
      ).toResolve();

      expect(logger.warn).toHaveBeenCalledWith(
        {
          err: expect.any(Error),
        },
        'Failed to set branch status',
      );
    });
  });

  describe('getBranchStatus', () => {
    const commitStatus = (status: CommitStatusType): CommitStatus => ({
      id: 1,
      status,
      context: '',
      description: '',
      target_url: '',
      created_at: '',
    });

    it('should return yellow for unknown result', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [commitStatus('unknown')]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', true);

      expect(res).toBe('yellow');
    });

    it('should return pending state for pending result', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [commitStatus('pending')]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', true);

      expect(res).toBe('yellow');
    });

    it('should return green state for success result', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [commitStatus('success')]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', true);

      expect(res).toBe('green');
    });

    it('should return yellow for all other results', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [commitStatus('invalid' as never)]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', true);

      expect(res).toBe('yellow');
    });

    it('should abort when branch status returns 404', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(404);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.getBranchStatus('some-branch', true)).rejects.toThrow(
        REPOSITORY_CHANGED,
      );
    });

    it('should propagate any other errors', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .replyWithError('unknown error');
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.getBranchStatus('some-branch', true)).rejects.toThrow(
        'unknown error',
      );
    });

    it('should treat internal checks as success', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [
          {
            id: 1,
            status: 'success',
            context: 'renovate/stability-days',
            description: 'internal check',
            target_url: '',
            created_at: '',
          },
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', true);

      expect(res).toBe('green');
    });

    it('should not treat internal checks as success', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [
          {
            id: 1,
            status: 'success',
            context: 'renovate/stability-days',
            description: 'internal check',
            target_url: '',
            created_at: '',
          },
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatus('some-branch', false);

      expect(res).toBe('yellow');
    });
  });

  describe('getBranchStatusCheck', () => {
    it('should return null with no results', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, []);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      expect(
        await gitea.getBranchStatusCheck('some-branch', 'some-context'),
      ).toBeNull();
    });

    it('should return null with no matching results', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [
          {
            id: 1,
            status: 'success',
            context: 'other-context',
            description: 'internal check',
            target_url: '',
            created_at: '',
          },
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatusCheck(
        'some-branch',
        'some-context',
      );

      expect(res).toBeNull();
    });

    it('should return yellow with unknown status', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [
          {
            id: 1,
            status: 'xyz',
            context: 'some-context',
            description: '',
            target_url: '',
            created_at: '',
          },
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatusCheck(
        'some-branch',
        'some-context',
      );

      expect(res).toBe('yellow');
    });

    it('should return green of matching result', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/commits/some-branch/statuses')
        .reply(200, [
          {
            id: 1,
            status: 'success',
            context: 'some-context',
            description: '',
            target_url: '',
            created_at: '',
          },
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchStatusCheck(
        'some-branch',
        'some-context',
      );

      expect(res).toBe('green');
    });
  });

  describe('getPrList', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('should return list of pull requests', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getPrList();
      expect(res).toMatchObject([
        { number: 1, title: 'Some PR' },
        { number: 2, title: 'Other PR' },
        { number: 3, title: 'Draft PR' },
      ]);
    });

    it('should filter list by creator', async () => {
      const thirdPartyPr = partial<PR>({
        number: 42,
        title: 'Third-party PR',
        body: 'other random pull request',
        state: 'open',
        diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/3.diff',
        created_at: '2011-08-18T22:30:38Z',
        closed_at: '2016-01-09T10:03:21Z',
        mergeable: true,
        base: { ref: 'third-party-base-branch' },
        head: {
          label: 'other-head-branch',
          sha: 'other-head-sha' as LongCommitSha,
          repo: partial<Repo>({ full_name: mockRepo.full_name }),
        },
        user: { username: 'not-renovate' },
      });

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, [
          thirdPartyPr,
          ...mockPRs.map((pr) => ({
            ...pr,
            user: { username: 'renovate' },
          })),
        ]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getPrList();

      expect(res).toMatchObject([
        { number: 1, title: 'Some PR' },
        { number: 2, title: 'Other PR' },
        { number: 3, title: 'Draft PR' },
      ]);
    });

    it('should cache results after first query', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res1 = await gitea.getPrList();
      const res2 = await gitea.getPrList();

      expect(res1).toEqual(res2);
    });

    it('should update cache results', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs.slice(0, 2))
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs.slice(1));
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res1 = await gitea.getPrList();
      expect(res1).toMatchObject([{ number: 1 }, { number: 2 }]);

      memCache.set('gitea-pr-cache-synced', false);

      const res2 = await gitea.getPrList();
      expect(res2).toMatchObject([{ number: 1 }, { number: 2 }, { number: 3 }]);
    });
  });

  describe('getPr', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('should return enriched pull request which exists if open', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getPr(1);

      expect(res).toMatchObject({ number: 1, title: 'Some PR' });
    });

    it('should fallback to direct fetching if cache fails', async () => {
      const pr = mockPRs.find((pr) => pr.number === 1);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, [])
        .get('/repos/some/repo/pulls/1')
        .reply(200, pr);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getPr(1);

      expect(res).toMatchObject({ number: 1, title: 'Some PR' });
    });

    it('should return null for missing pull request', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, [])
        .get('/repos/some/repo/pulls/42')
        .reply(200); // TODO: 404 should be handled
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getPr(42);

      expect(res).toBeNull();
    });
  });

  describe('findPr', () => {
    it('should find pull request without title or state', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({ branchName: 'some-head-branch' });

      expect(res).toMatchObject({
        number: 1,
        sourceBranch: 'some-head-branch',
      });
    });

    it('should find pull request with title', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({
        branchName: 'some-head-branch',
        prTitle: 'Some PR',
      });

      expect(res).toMatchObject({
        number: 1,
        title: 'Some PR',
      });
    });

    it('should find pull request with state', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({
        branchName: 'some-head-branch',
        state: 'open',
      });

      expect(res).toMatchObject({
        number: 1,
        state: 'open',
      });
    });

    it('should not find pull request with inverted state', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({
        branchName: 'other-head-branch',
        state: `!open`,
      });

      expect(res).toMatchObject({
        number: 2,
        state: 'closed',
        title: 'Other PR',
      });
    });

    it('should find pull request with title and state', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({
        branchName: 'other-head-branch',
        prTitle: 'Other PR',
        state: 'closed',
      });

      expect(res).toMatchObject({
        number: 2,
        state: 'closed',
        title: 'Other PR',
      });
    });

    it('should find pull request with draft', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({
        branchName: 'draft-head-branch',
        prTitle: 'Draft PR',
        state: 'open',
      });

      expect(res).toMatchObject({
        number: 3,
        title: 'Draft PR',
        isDraft: true,
      });
    });

    it('should return null for missing pull request', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findPr({ branchName: 'missing' });

      expect(res).toBeNull();
    });
  });

  describe('createPr', () => {
    beforeEach(() => {
      memCache.init();
      memCache.set('gitea-pr-cache-synced', true);
    });

    const mockNewPR: MockPr = {
      number: 42,
      state: 'open',
      head: {
        label: 'pr-branch',
        sha: mockCommitHash,
        repo: partial<Repo>({ full_name: mockRepo.full_name }),
      },
      base: {
        ref: mockRepo.default_branch,
      },
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/42.diff',
      title: 'pr-title',
      body: 'pr-body',
      mergeable: true,
      created_at: '2014-04-01T05:14:20Z',
      closed_at: '2017-12-28T12:17:48Z',
      updated_at: '2017-12-28T12:17:48Z',
    };

    it('should use base branch by default', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, {
          ...mockNewPR,
          base: { ref: 'devel' },
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'devel',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('should use default branch if requested', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        draftPR: true,
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('should resolve and apply optional labels to pull request', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR)
        .get('/repos/some/repo/labels')
        .reply(200, mockRepoLabels)
        .get('/orgs/some/labels')
        .reply(200, mockOrgLabels);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        labels: [...mockRepoLabels, ...mockOrgLabels].map(({ name }) => name),
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('should ensure new pull request gets added to cached pull requests', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await gitea.getPrList();
      await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });
      const res = await gitea.getPr(mockNewPR.number);

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('should attempt to resolve 409 conflict error (w/o update)', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(409)
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, [mockNewPR]);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('should attempt to resolve 409 conflict error (w/ update)', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(409)
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, [mockNewPR])
        .patch('/repos/some/repo/pulls/42')
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: 'new-title',
        prBody: 'new-body',
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'new-title',
      });
    });

    it('should abort when response for created pull request is invalid', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, {});
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.createPr({
          sourceBranch: mockNewPR.head.label,
          targetBranch: 'master',
          prTitle: mockNewPR.title,
          prBody: mockNewPR.body,
        }),
      ).rejects.toThrow();
    });

    it('should use platform automerge', async () => {
      memCache.set('gitea-pr-cache-synced', true);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR)
        .post('/repos/some/repo/pulls/42/merge')
        .reply(200);
      await initFakePlatform(scope, '1.17.0');
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        platformOptions: { usePlatformAutomerge: true },
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it('continues on platform automerge error', async () => {
      memCache.set('gitea-pr-cache-synced', true);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR)
        .post('/repos/some/repo/pulls/42/merge')
        .replyWithError('unknown error');
      await initFakePlatform(scope, '1.17.0');
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        platformOptions: { usePlatformAutomerge: true },
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ prNumber: 42 }),
        'Gitea-native automerge: fail',
      );
    });

    it('continues if platform automerge is not supported', async () => {
      memCache.set('gitea-pr-cache-synced', true);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR);
      await initFakePlatform(scope, '1.10.0');
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        platformOptions: { usePlatformAutomerge: true },
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ prNumber: 42 }),
        'Gitea-native automerge: not supported on this version of Gitea. Use 1.17.0 or newer.',
      );
    });

    it('should create PR with repository merge method when automergeStrategy is auto', async () => {
      memCache.set('gitea-pr-cache-synced', true);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls')
        .reply(200, mockNewPR)
        .post('/repos/some/repo/pulls/42/merge')
        .reply(200);
      await initFakePlatform(scope, '1.17.0');
      await initFakeRepo(scope);

      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        platformOptions: {
          automergeStrategy: 'auto',
          usePlatformAutomerge: true,
        },
      });

      expect(res).toMatchObject({
        number: 42,
        title: 'pr-title',
      });
    });

    it.each`
      automergeStrategy | prMergeStrategy
      ${'fast-forward'} | ${'rebase'}
      ${'merge-commit'} | ${'merge'}
      ${'rebase'}       | ${'rebase-merge'}
      ${'squash'}       | ${'squash'}
    `(
      'should create PR with mergeStrategy $prMergeStrategy',
      async ({ automergeStrategy, prMergeStrategy }) => {
        memCache.set('gitea-pr-cache-synced', true);
        const scope = httpMock
          .scope('https://gitea.com/api/v1')
          .post('/repos/some/repo/pulls')
          .reply(200, mockNewPR)
          .post('/repos/some/repo/pulls/42/merge')
          .reply(200, {
            Do: prMergeStrategy,
            merge_when_checks_succeed: true,
          });
        await initFakePlatform(scope, '1.17.0');
        await initFakeRepo(scope);

        const res = await gitea.createPr({
          sourceBranch: mockNewPR.head.label,
          targetBranch: 'master',
          prTitle: mockNewPR.title,
          prBody: mockNewPR.body,
          platformOptions: {
            automergeStrategy,
            usePlatformAutomerge: true,
          },
        });

        expect(res).toMatchObject({
          number: 42,
          title: 'pr-title',
        });
      },
    );
  });

  describe('updatePr', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('should update pull request with title', async () => {
      const pr = mockPRs.find((pr) => pr.number === 1);
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .patch('/repos/some/repo/pulls/1', { title: 'New Title' })
        .reply(200, pr);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.updatePr({ number: 1, prTitle: 'New Title' }),
      ).toResolve();
    });

    it('should update pull target branch', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .patch('/repos/some/repo/pulls/1', {
          title: 'New Title',
          base: 'New Base',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.updatePr({
          number: 1,
          prTitle: 'New Title',
          targetBranch: 'New Base',
        }),
      ).toResolve();
    });

    it('should update pull request with title and body', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .patch('/repos/some/repo/pulls/1', {
          title: 'New Title',
          body: 'New Body',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.updatePr({
          number: 1,
          prTitle: 'New Title',
          prBody: 'New Body',
        }),
      ).toResolve();
    });

    it('should update pull request with draft', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .patch('/repos/some/repo/pulls/3', {
          title: 'WIP: New Title',
          body: 'New Body',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.updatePr({
          number: 3,
          prTitle: 'New Title',
          prBody: 'New Body',
        }),
      ).toResolve();
    });

    it('should close pull request', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .patch('/repos/some/repo/pulls/1', {
          title: 'New Title',
          body: 'New Body',
          state: 'closed',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.updatePr({
          number: 1,
          prTitle: 'New Title',
          prBody: 'New Body',
          state: 'closed',
        }),
      ).toResolve();
    });

    it('should update labels', async () => {
      const updatedMockPR = partial<PR>({
        ...mockPRs[0],
        number: 1,
        title: 'New Title',
        body: 'New Body',
        state: 'open',
        labels: [
          {
            id: 1,
            name: 'some-label',
          },
        ],
      });
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .get('/repos/some/repo/labels')
        .reply(200, mockRepoLabels)
        .get('/orgs/some/labels')
        .reply(200, mockOrgLabels)
        .patch('/repos/some/repo/pulls/1')
        .reply(200, updatedMockPR);

      await initFakePlatform(scope);
      await initFakeRepo(scope);
      await expect(
        gitea.updatePr({
          number: 1,
          prTitle: 'New Title',
          prBody: 'New Body',
          state: 'open',
          labels: ['some-label'],
        }),
      ).toResolve();
    });

    it('should log a warning if labels could not be looked up', async () => {
      const updatedMockPR = partial<PR>({
        ...mockPRs[0],
        number: 1,
        title: 'New Title',
        body: 'New Body',
        state: 'open',
        labels: [
          {
            id: 1,
            name: 'some-label',
          },
        ],
      });
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs)
        .get('/repos/some/repo/labels')
        .reply(200, mockRepoLabels)
        .get('/orgs/some/labels')
        .reply(200, mockOrgLabels)
        .patch('/repos/some/repo/pulls/1')
        .reply(200, updatedMockPR);

      await initFakePlatform(scope);
      await initFakeRepo(scope);
      await expect(
        gitea.updatePr({
          number: 1,
          prTitle: 'New Title',
          prBody: 'New Body',
          state: 'open',
          labels: ['some-label', 'unavailable-label'],
        }),
      ).toResolve();
      expect(logger.warn).toHaveBeenCalledWith(
        'Some labels could not be looked up. Renovate may halt label updates assuming changes by others.',
      );
    });
  });

  describe('mergePr', () => {
    it('should return true when merging succeeds', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls/1/merge', {
          Do: 'rebase',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.mergePr({
        branchName: 'some-branch',
        id: 1,
      });

      expect(res).toBe(true);
    });

    it('should return false when merging fails', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls/1/merge', {
          Do: 'squash',
        })
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.mergePr({
        branchName: 'some-branch',
        id: 1,
        strategy: 'squash',
      });

      expect(res).toBe(false);
    });
  });

  describe('getIssueList', () => {
    it('should return empty for disabled issues', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      await initFakePlatform(scope);
      await initFakeRepo(scope, { has_issues: false });

      const res = await gitea.getIssueList();

      expect(res).toBeEmptyArray();
    });
  });

  describe('getIssue', () => {
    it('should return the issue', async () => {
      const mockIssue = mockIssues.find((i) => i.number === 1)!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1')
        .reply(200, mockIssue);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getIssue?.(mockIssue.number);

      expect(res).toEqual({
        body: 'some-content',
        number: 1,
      });
    });

    it('should return null for disabled issues', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      await initFakePlatform(scope);
      await initFakeRepo(scope, { has_issues: false });

      const res = await gitea.getIssue!(1);

      expect(res).toBeNull();
    });
  });

  describe('findIssue', () => {
    it('should return existing open issue', async () => {
      const mockIssue = mockIssues.find(({ title }) => title === 'open-issue')!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .get('/repos/some/repo/issues/1')
        .reply(200, mockIssue);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findIssue(mockIssue.title);

      expect(res).toMatchObject({
        body: 'some-content',
        number: 1,
      });
    });

    it('should not return existing closed issue', async () => {
      const mockIssue = mockIssues.find(
        ({ title }) => title === 'closed-issue',
      )!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findIssue(mockIssue.title);

      expect(res).toBeNull();
    });

    it('should return null for missing issue', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.findIssue('missing');

      expect(res).toBeNull();
    });
  });

  describe('ensureIssue', () => {
    it('should create issue if not found', async () => {
      const mockIssue = {
        title: 'new-title',
        body: 'new-body',
        shouldReOpen: false,
        once: false,
      };

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .post('/repos/some/repo/issues', {
          body: mockIssue.body,
          title: mockIssue.title,
        })
        .reply(200, { number: 42 });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue(mockIssue);

      expect(res).toBe('created');
    });

    it('should create issue with the correct labels', async () => {
      const mockIssue: EnsureIssueConfig = {
        title: 'new-title',
        body: 'new-body',
        shouldReOpen: false,
        once: false,
        labels: ['Renovate', 'Maintenance'],
      };

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .get('/repos/some/repo/labels')
        .reply(200, [
          partial<Label>({ id: 1, name: 'Renovate' }),
          partial<Label>({ id: 3, name: 'Maintenance' }),
        ] satisfies Label[])
        .get('/orgs/some/labels')
        .reply(200, mockOrgLabels)
        .post('/repos/some/repo/issues', {
          body: 'new-body',
          title: 'new-title',
          labels: [1, 3],
        })
        .reply(200, { number: 42 });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue(mockIssue);

      expect(res).toBe('created');
    });

    it('should not reopen closed issue by default', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue')!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .patch('/repos/some/repo/issues/2', {
          body: closedIssue.body,
          state: closedIssue.state,
          title: 'closed-issue',
        })
        .reply(200, closedIssue);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: false,
        once: false,
      });

      expect(res).toBe('updated');
    });

    it('should not update labels when not necessary', async () => {
      const mockLabels: Label[] = [
        partial<Label>({ id: 1, name: 'Renovate' }),
        partial<Label>({ id: 3, name: 'Maintenance' }),
      ];
      const mockIssue: Issue = {
        number: 10,
        title: 'label-issue',
        body: 'label-body',
        assignees: [],
        labels: mockLabels,
        state: 'open',
      };

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, [mockIssue])
        .patch('/repos/some/repo/issues/10')
        .reply(200, mockIssue)
        .get('/repos/some/repo/labels')
        .reply(200, mockLabels)
        .get('/orgs/some/labels')
        .reply(200, []);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: mockIssue.title,
        body: 'new-body',
        labels: ['Renovate', 'Maintenance'],
      });

      expect(res).toBe('updated');
    });

    it('should update labels when missing', async () => {
      const mockLabels: Label[] = [
        partial<Label>({ id: 1, name: 'Renovate' }),
        partial<Label>({ id: 3, name: 'Maintenance' }),
      ];
      const mockIssue: Issue = {
        number: 10,
        title: 'label-issue',
        body: 'label-body',
        assignees: [],
        labels: [mockLabels[0]],
        state: 'open',
      };

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, [mockIssue])
        .patch('/repos/some/repo/issues/10')
        .reply(200, mockIssue)
        .get('/repos/some/repo/labels')
        .reply(200, mockLabels)
        .get('/orgs/some/labels')
        .reply(200, [])
        .put('/repos/some/repo/issues/10/labels', { labels: [1, 3] })
        .reply(200, mockLabels);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: mockIssue.title,
        body: 'new-body',
        labels: ['Renovate', 'Maintenance'],
      });

      expect(res).toBe('updated');
    });

    it('should reset labels when others have been set', async () => {
      const mockLabels: Label[] = [
        partial<Label>({ id: 1, name: 'Renovate' }),
        partial<Label>({ id: 2, name: 'Other label' }),
        partial<Label>({ id: 3, name: 'Maintenance' }),
      ];
      const mockIssue: Issue = {
        number: 10,
        title: 'label-issue',
        body: 'label-body',
        assignees: [],
        labels: mockLabels,
        state: 'open',
      };

      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, [mockIssue])
        .patch('/repos/some/repo/issues/10')
        .reply(200, mockIssue)
        .get('/repos/some/repo/labels')
        .reply(200, mockLabels)
        .get('/orgs/some/labels')
        .reply(200, [])
        .put('/repos/some/repo/issues/10/labels', { labels: [1, 3] })
        .reply(200, mockLabels);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: mockIssue.title,
        body: 'new-body',
        labels: ['Renovate', 'Maintenance'],
      });

      expect(res).toBe('updated');
    });

    it('should reopen closed issue if desired', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue')!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .patch('/repos/some/repo/issues/2', {
          body: closedIssue.body,
          state: 'open',
          title: 'closed-issue',
        })
        .reply(200, { ...closedIssue, state: 'open' });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: true,
        once: false,
      });

      expect(res).toBe('updated');
    });

    it('should not update existing closed issue if desired', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue')!;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: false,
        once: true,
      });

      expect(res).toBeNull();
    });

    it('should close all open duplicate issues except first one when updating', async () => {
      const duplicates = mockIssues.filter(
        (i) => i.title === 'duplicate-issue',
      );
      const [first, second, third] = duplicates;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, duplicates)
        .patch(`/repos/some/repo/issues/${second.number}`, {
          state: 'closed',
        })
        .reply(200, { ...second, state: 'closed' })
        .patch(`/repos/some/repo/issues/${third.number}`, {
          state: 'closed',
        })
        .reply(200, { ...third, state: 'closed' });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureIssue({
        title: first.title,
        body: first.body,
        shouldReOpen: false,
        once: false,
      });

      expect(res).toBeNull();
    });

    it('should reset issue cache when creating an issue', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .twice()
        .reply(200, mockIssues)
        .post('/repos/some/repo/issues')
        .reply(200, { number: 42 });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.ensureIssue({
          title: 'new-title',
          body: 'new-body',
          shouldReOpen: false,
          once: false,
        }),
      ).resolves.toBe('created');

      await expect(gitea.getIssueList()).toResolve();
    });

    it('should gracefully fail with warning', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await gitea.ensureIssue({
        title: 'new-title',
        body: 'new-body',
        shouldReOpen: false,
        once: false,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Could not ensure issue',
      );
    });

    it('should return null for disabled issues', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      await initFakePlatform(scope);
      await initFakeRepo(scope, { has_issues: false });

      await expect(
        gitea.ensureIssue({
          title: 'new-title',
          body: 'new-body',
          shouldReOpen: false,
          once: false,
        }),
      ).resolves.toBeNull();
    });
  });

  describe('ensureIssueClosing', () => {
    it('should close issues with matching title', async () => {
      const mockIssue = mockIssues[0];
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues')
        .query({ state: 'all', type: 'issues' })
        .reply(200, mockIssues)
        .patch('/repos/some/repo/issues/1', { state: 'closed' })
        .reply(200, { ...mockIssue, state: 'closed' });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.ensureIssueClosing(mockIssue.title)).toResolve();
    });

    it('should return for disabled issues', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      await initFakePlatform(scope);
      await initFakeRepo(scope, { has_issues: false });
      await expect(gitea.ensureIssueClosing('new-title')).toResolve();
    });
  });

  describe('deleteLabel', () => {
    it('should delete a label which exists', async () => {
      const mockLabel = mockRepoLabels[0];
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/orgs/some/labels')
        .replyWithError('unknown')
        .get('/repos/some/repo/labels')
        .reply(200, mockRepoLabels)
        .delete(`/repos/some/repo/issues/42/labels/${mockLabel.id}`)
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.deleteLabel(42, mockLabel.name)).toResolve();
    });

    it('should gracefully fail with warning if label is missing', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/orgs/some/labels')
        .reply(200, [])
        .get('/repos/some/repo/labels')
        .reply(200, mockRepoLabels);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.deleteLabel(42, 'missing')).toResolve();

      expect(logger.warn).toHaveBeenCalledWith(
        { issue: 42, labelName: 'missing' },
        'Failed to lookup label for deletion',
      );
    });
  });

  describe('ensureComment', () => {
    it('should add comment with topic if not found', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .post('/repos/some/repo/issues/1/comments', {
          body: '### other-topic\n\nother-content',
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureComment({
        number: 1,
        topic: 'other-topic',
        content: 'other-content',
      });

      expect(res).toBeTrue();
    });

    it('should add comment without topic if not found', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .post('/repos/some/repo/issues/1/comments', { body: 'other-content' })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureComment({
        number: 1,
        content: 'other-content',
        topic: null,
      });

      expect(res).toBeTrue();
    });

    it('should update comment with topic if found', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .patch('/repos/some/repo/issues/comments/13', {
          body: '### some-topic\n\nsome-new-content',
        })
        .reply(200, partial<Comment>({ id: 13 }));
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-new-content',
      });

      expect(res).toBeTrue();
    });

    it('should skip if comment is up-to-date', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-content',
      });

      expect(res).toBeTrue();
    });

    it('should gracefully fail with warning', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-content',
      });

      expect(res).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error), issue: 1, subject: 'some-topic' },
        'Error ensuring comment',
      );
    });
  });

  describe('ensureCommentRemoval', () => {
    it('should remove existing comment by topic', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .delete('/repos/some/repo/issues/comments/13')
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.ensureCommentRemoval({
          type: 'by-topic',
          number: 1,
          topic: 'some-topic',
        }),
      ).toResolve();
    });

    it('should remove existing comment by content', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .delete('/repos/some/repo/issues/comments/11')
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.ensureCommentRemoval({
          type: 'by-content',
          number: 1,
          content: 'some-body',
        }),
      ).toResolve();
    });

    it('should gracefully fail with warning', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments)
        .delete('/repos/some/repo/issues/comments/13')
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await gitea.ensureCommentRemoval({
        type: 'by-topic',
        number: 1,
        topic: 'some-topic',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        {
          config: { number: 1, topic: 'some-topic', type: 'by-topic' },
          err: expect.any(Error),
          issue: 1,
        },
        'Error deleting comment',
      );
    });

    it('should abort silently if comment is missing', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/issues/1/comments')
        .reply(200, mockComments);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(
        gitea.ensureCommentRemoval({
          type: 'by-topic',
          number: 1,
          topic: 'missing',
        }),
      ).toResolve();
    });
  });

  describe('getBranchPr', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('should return existing pull request for branch', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getBranchPr('some-head-branch');

      expect(res).toMatchObject({ number: 1 });
    });

    it('should return null if no pull request exists', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/pulls')
        .query({ state: 'all', sort: 'recentupdate' })
        .reply(200, mockPRs);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      expect(await gitea.getBranchPr('missing')).toBeNull();
    });
  });

  describe('addAssignees', () => {
    it('should add assignees to the issue', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .patch('/repos/some/repo/issues/1', {
          assignees: ['me', 'you'],
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.addAssignees(1, ['me', 'you'])).toResolve();
    });
  });

  describe('addReviewers', () => {
    it('should assign reviewers', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls/1/requested_reviewers', {
          reviewers: ['me', 'you'],
        })
        .reply(200);
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      await expect(gitea.addReviewers(1, ['me', 'you'])).toResolve();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should do nothing for older Gitea versions', async () => {
      const scope = httpMock.scope('https://gitea.com/api/v1');
      await initFakePlatform(scope, '1.10.0');
      await initFakeRepo(scope);

      await expect(gitea.addReviewers(1, ['me', 'you'])).toResolve();
    });

    it('catches errors', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .post('/repos/some/repo/pulls/1/requested_reviewers', {
          reviewers: ['me', 'you'],
        })
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);
      ///
      await expect(gitea.addReviewers(1, ['me', 'you'])).toResolve();
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error), number: 1, reviewers: ['me', 'you'] },
        'Failed to assign reviewer',
      );
    });
  });

  describe('massageMarkdown', () => {
    it('replaces pr links', () => {
      const body =
        '[#123](../pull/123) [#124](../pull/124) [#125](../pull/125)';

      expect(gitea.massageMarkdown(body)).toBe(
        '[#123](pulls/123) [#124](pulls/124) [#125](pulls/125)',
      );
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json')
        .reply(200, {
          content: Buffer.from(JSON.stringify(data), 'utf-8'),
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getJsonFile('file.json');

      expect(res).toEqual(data);
    });

    it('returns file content from given repo', async () => {
      const data = { foo: 'bar' };
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/different/repo/contents/file.json')
        .reply(200, {
          content: Buffer.from(JSON.stringify(data), 'utf-8'),
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope, { full_name: 'different/repo' });

      const res = await gitea.getJsonFile('file.json', 'different/repo');

      expect(res).toEqual(data);
    });

    it('returns file content from branch or tag', async () => {
      const data = { foo: 'bar' };
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json?ref=dev')
        .reply(200, {
          content: Buffer.from(JSON.stringify(data), 'utf-8'),
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getJsonFile('file.json', 'some/repo', 'dev');

      expect(res).toEqual(data);
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json5')
        .reply(200, {
          content: Buffer.from(json5Data, 'utf-8'),
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope);

      const res = await gitea.getJsonFile('file.json5');

      expect(res).toEqual({ foo: 'bar' });
    });

    it('throws on malformed JSON', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json')
        .reply(200, {
          content: Buffer.from('!@#', 'utf-8'),
        });
      await initFakePlatform(scope);
      await initFakeRepo(scope);
      await expect(gitea.getJsonFile('file.json')).rejects.toThrow();
    });

    it('returns null on missing content', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json')
        .reply(200, {});
      await initFakePlatform(scope);
      await initFakeRepo(scope);
      expect(await gitea.getJsonFile('file.json')).toBeNull();
    });

    it('throws on errors', async () => {
      const scope = httpMock
        .scope('https://gitea.com/api/v1')
        .get('/repos/some/repo/contents/file.json')
        .replyWithError('unknown');
      await initFakePlatform(scope);
      await initFakeRepo(scope);
      await expect(gitea.getJsonFile('file.json')).rejects.toThrow();
    });
  });
});
