// TODO fix mocks
import type { Platform, RepoParams } from '..';
import * as httpMock from '../../../../test/http-mock';
import {
  CONFIG_GIT_URL_UNAVAILABLE,
  REPOSITORY_ARCHIVED,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../../constants/error-messages';
import type { logger as _logger } from '../../../logger';
import { BranchStatus, PrState } from '../../../types';
import type * as _git from '../../../util/git';
import type * as _hostRules from '../../../util/host-rules';
import { toBase64 } from '../../../util/string';

const gitlabApiHost = 'https://gitlab.com';

describe('modules/platform/gitlab/index', () => {
  let gitlab: Platform;
  let hostRules: jest.Mocked<typeof _hostRules>;
  let git: jest.Mocked<typeof _git>;
  let logger: jest.Mocked<typeof _logger>;

  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.resetAllMocks();
    gitlab = await import('.');
    jest.mock('../../../logger');
    logger = (await import('../../../logger')).logger as never;
    jest.mock('../../../util/host-rules');
    jest.mock('delay');
    hostRules = require('../../../util/host-rules');
    jest.mock('../../../util/git');
    git = require('../../../util/git');
    git.branchExists.mockReturnValue(true);
    git.isBranchBehindBase.mockResolvedValue(true);
    git.getBranchCommit.mockReturnValue(
      '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
    );
    hostRules.find.mockReturnValue({
      token: '123test',
    });
    delete process.env.GITLAB_IGNORE_REPO_URL;
  });

  async function initFakePlatform(version: string) {
    httpMock
      .scope(gitlabApiHost)
      .get('/api/v4/user')
      .reply(200, {
        email: 'a@b.com',
        name: 'Renovate Bot',
      })
      .get('/api/v4/version')
      .reply(200, {
        version: `${version}-ee`,
      });

    await gitlab.initPlatform({
      token: 'some-token',
      endpoint: undefined,
    });
  }

  describe('initPlatform()', () => {
    it(`should throw if no token`, async () => {
      await expect(gitlab.initPlatform({} as any)).rejects.toThrow();
    });

    it(`should throw if auth fails`, async () => {
      // user
      httpMock.scope(gitlabApiHost).get('/api/v4/user').reply(403);
      const res = gitlab.initPlatform({
        token: 'some-token',
        endpoint: undefined,
      });
      await expect(res).rejects.toThrow('Init: Authentication failure');
    });

    it(`should default to gitlab.com`, async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/user').reply(200, {
        email: 'a@b.com',
        name: 'Renovate Bot',
      });
      httpMock.scope(gitlabApiHost).get('/api/v4/version').reply(200, {
        version: '13.3.6-ee',
      });
      expect(
        await gitlab.initPlatform({
          token: 'some-token',
          endpoint: undefined,
        })
      ).toMatchSnapshot();
    });

    it(`should accept custom endpoint`, async () => {
      const endpoint = 'https://gitlab.renovatebot.com';
      httpMock
        .scope(endpoint)
        .get('/user')
        .reply(200, {
          email: 'a@b.com',
          name: 'Renovate Bot',
        })
        .get('/version')
        .reply(200, {
          version: '13.3.6-ee',
        });
      expect(
        await gitlab.initPlatform({
          endpoint,
          token: 'some-token',
        })
      ).toMatchSnapshot();
    });

    it(`should reuse existing gitAuthor`, async () => {
      httpMock.scope(gitlabApiHost).get('/api/v4/version').reply(200, {
        version: '13.3.6-ee',
      });
      expect(
        await gitlab.initPlatform({
          token: 'some-token',
          endpoint: undefined,
          gitAuthor: 'somebody',
        })
      ).toEqual({ endpoint: 'https://gitlab.com/api/v4/' });
    });
  });

  describe('getRepos', () => {
    it('should throw an error if it receives an error', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects?membership=true&per_page=100&with_merge_requests_enabled=true&min_access_level=30&archived=false'
        )
        .replyWithError('getRepos error');
      await expect(gitlab.getRepos()).rejects.toThrow('getRepos error');
    });

    it('should return an array of repos', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects?membership=true&per_page=100&with_merge_requests_enabled=true&min_access_level=30&archived=false'
        )
        .reply(200, [
          {
            path_with_namespace: 'a/b',
          },
          {
            path_with_namespace: 'c/d',
          },
          {
            path_with_namespace: 'c/f',
            mirror: true,
          },
        ]);
      const repos = await gitlab.getRepos();
      expect(repos).toEqual(['a/b', 'c/d']);
    });
  });

  async function initRepo(
    repoParams: RepoParams = {
      repository: 'some/repo',
    },
    repoResp: httpMock.Body | null = null,
    scope = httpMock.scope(gitlabApiHost)
  ): Promise<httpMock.Scope> {
    const repo = repoParams.repository;
    const justRepo = repo.split('/').slice(0, 2).join('/');
    scope.get(`/api/v4/projects/${encodeURIComponent(repo)}`).reply(
      200,
      repoResp ?? {
        default_branch: 'master',
        http_url_to_repo: `https://gitlab.com/${justRepo}.git`,
      }
    );
    await gitlab.initRepo(repoParams);
    return scope;
  }

  describe('initRepo', () => {
    const okReturn = { default_branch: 'master', url: 'https://some-url' };

    it(`should escape all forward slashes in project names`, async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo%2Fproject')
        .reply(200, okReturn);
      expect(
        await gitlab.initRepo({
          repository: 'some/repo/project',
        })
      ).toEqual({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: expect.any(String),
      });
    });

    it('should throw an error if receiving an error', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .replyWithError('always error');
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow('always error');
    });

    it('should throw an error if repository is archived', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { archived: true });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_ARCHIVED);
    });

    it('should throw an error if repository is a mirror', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { mirror: true });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_MIRRORED);
    });

    it('should throw an error if repository access is disabled', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { repository_access_level: 'disabled' });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });

    it('should throw an error if MRs are disabled', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { merge_requests_access_level: 'disabled' });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });

    it('should throw an error if repository has empty_repo property', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { empty_repo: true });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_EMPTY);
    });

    it('should throw an error if repository is empty', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, { default_branch: null });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
        })
      ).rejects.toThrow(REPOSITORY_EMPTY);
    });

    it('should fall back if http_url_to_repo is empty', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo%2Fproject')
        .reply(200, {
          default_branch: 'master',
          http_url_to_repo: null,
        });
      expect(
        await gitlab.initRepo({
          repository: 'some/repo/project',
        })
      ).toEqual({
        defaultBranch: 'master',
        isFork: false,
        repoFingerprint: expect.any(String),
      });
    });

    it('should use ssh_url_to_repo if gitUrl is set to ssh', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo%2Fproject')
        .reply(200, {
          default_branch: 'master',
          http_url_to_repo: `https://gitlab.com/some%2Frepo%2Fproject.git`,
          ssh_url_to_repo: `ssh://git@gitlab.com/some%2Frepo%2Fproject.git`,
        });
      await gitlab.initRepo({
        repository: 'some/repo/project',
        gitUrl: 'ssh',
      });

      expect(git.initRepo.mock.calls).toMatchSnapshot();
    });

    it('should throw if ssh_url_to_repo is not present but gitUrl is set to ssh', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo%2Fproject')
        .reply(200, {
          default_branch: 'master',
          http_url_to_repo: `https://gitlab.com/some%2Frepo%2Fproject.git`,
        });
      await expect(
        gitlab.initRepo({
          repository: 'some/repo/project',
          gitUrl: 'ssh',
        })
      ).rejects.toThrow(CONFIG_GIT_URL_UNAVAILABLE);
    });

    it('should fall back respecting when GITLAB_IGNORE_REPO_URL is set', async () => {
      process.env.GITLAB_IGNORE_REPO_URL = 'true';
      const selfHostedUrl = 'http://mycompany.com/gitlab';
      httpMock
        .scope(selfHostedUrl)
        .get('/api/v4/user')
        .reply(200, {
          email: 'a@b.com',
          name: 'Renovate Bot',
        })
        .get('/api/v4/version')
        .reply(200, {
          version: '13.8.0',
        });
      await gitlab.initPlatform({
        endpoint: `${selfHostedUrl}/api/v4`,
        token: 'mytoken',
      });
      httpMock
        .scope(selfHostedUrl)
        .get('/api/v4/projects/some%2Frepo%2Fproject')
        .reply(200, {
          default_branch: 'master',
          http_url_to_repo: `http://other.host.com/gitlab/some/repo/project.git`,
        });
      await gitlab.initRepo({
        repository: 'some/repo/project',
      });
      expect(git.initRepo.mock.calls).toMatchSnapshot();
    });
  });

  describe('getRepoForceRebase', () => {
    it('should return false', async () => {
      await initRepo(
        {
          repository: 'some/repo/project',
        },
        {
          default_branch: 'master',
          http_url_to_repo: null,
          merge_method: 'merge',
        }
      );
      expect(await gitlab.getRepoForceRebase()).toBeFalse();
    });

    it('should return true', async () => {
      await initRepo(
        {
          repository: 'some/repo/project',
        },
        {
          default_branch: 'master',
          http_url_to_repo: null,
          merge_method: 'ff',
        }
      );
      expect(await gitlab.getRepoForceRebase()).toBeTrue();
    });
  });

  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toBeNull();
    });

    it('should return the PR object', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 91,
            title: 'some change',
            source_branch: 'some-branch',
            target_branch: 'master',
            state: 'opened',
          },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests/91?include_diverged_commits_count=1'
        )
        .reply(200, {
          iid: 91,
          title: 'some change',
          state: 'opened',
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          target_branch: 'master',
          base: {
            sha: '1234',
          },
        });
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toMatchSnapshot();
    });

    it('should strip draft prefix from title', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 91,
            title: 'Draft: some change',
            source_branch: 'some-branch',
            target_branch: 'master',
            state: 'opened',
          },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests/91?include_diverged_commits_count=1'
        )
        .reply(200, {
          iid: 91,
          title: 'Draft: some change',
          state: 'opened',
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          target_branch: 'master',
          base: {
            sha: '1234',
          },
        });
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toMatchSnapshot();
    });

    it('should strip deprecated draft prefix from title', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 91,
            title: 'WIP: some change',
            source_branch: 'some-branch',
            target_branch: 'master',
            state: 'opened',
          },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests/91?include_diverged_commits_count=1'
        )
        .reply(200, {
          iid: 91,
          title: 'WIP: some change',
          state: 'opened',
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          target_branch: 'master',
          base: {
            sha: '1234',
          },
        });
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toMatchSnapshot();
    });
  });

  describe('getBranchStatus(branchName, ignoreTests)', () => {
    it('returns pending if no results', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.yellow);
    });

    it('returns success if no results but head pipeline success', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 91,
            title: 'some change',
            source_branch: 'some-branch',
            target_branch: 'master',
            state: 'opened',
          },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests/91?include_diverged_commits_count=1'
        )
        .reply(200, {
          iid: 91,
          title: 'some change',
          state: 'opened',
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          target_branch: 'master',
          base: {
            sha: '1234',
          },
          head_pipeline: {
            status: 'success',
          },
        });
      const res = await gitlab.getBranchStatus('some-branch');
      expect(res).toEqual(BranchStatus.green);
    });

    it('returns success if all are success', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'success' }, { status: 'success' }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.green);
    });

    it('returns success if optional jobs fail', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.green);
    });

    it('returns success if all are optional', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'failed', allow_failure: true }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.green);
    });

    it('returns success if job is skipped', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'success' }, { status: 'skipped' }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.green);
    });

    it('returns yellow if there are no jobs expect skipped', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'skipped' }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.yellow);
    });

    it('returns failure if any mandatory jobs fails and one job is skipped', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'skipped' }, { status: 'failed' }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.red);
    });

    it('returns failure if any mandatory jobs fails', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
          { status: 'success' },
          { status: 'failed', allow_failure: true },
          { status: 'failed' },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.red);
    });

    it('maps custom statuses to yellow', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ status: 'success' }, { status: 'foo' }])
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatus('somebranch');
      expect(res).toEqual(BranchStatus.yellow);
    });

    it('throws repository-changed', async () => {
      expect.assertions(1);
      git.branchExists.mockReturnValue(false);
      await initRepo();
      await expect(gitlab.getBranchStatus('somebranch')).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });
  });

  describe('getBranchStatusCheck', () => {
    it('returns null if no results', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, []);
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });

    it('returns null if no matching results', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [{ name: 'context-1', status: 'pending' }]);
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });

    it('returns status if name found', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
        )
        .reply(200, [
          { name: 'context-1', status: 'pending' },
          { name: 'some-context', status: 'success' },
          { name: 'context-3', status: 'failed' },
        ]);
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual(BranchStatus.green);
    });
  });

  describe('setBranchStatus', () => {
    it.each([BranchStatus.green, BranchStatus.yellow, BranchStatus.red])(
      'sets branch status %s',
      async (state) => {
        const scope = await initRepo();
        scope
          .post(
            '/api/v4/projects/some%2Frepo/statuses/0d9c7726c3d628b7e28af234595cfd20febdbf8e'
          )
          .reply(200, {})
          .get(
            '/api/v4/projects/some%2Frepo/repository/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e/statuses'
          )
          .reply(200, []);

        await expect(
          gitlab.setBranchStatus({
            branchName: 'some-branch',
            context: 'some-context',
            description: 'some-description',
            state,
            url: 'some-url',
          })
        ).toResolve();
      }
    );
  });

  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ]);
      const res = await gitlab.findIssue('title-3');
      expect(res).toBeNull();
    });

    it('finds issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .get('/api/v4/projects/undefined/issues/2')
        .reply(200, { description: 'new-content' });
      const res = await gitlab.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });

  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .post('/api/v4/projects/undefined/issues')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'new-title',
        body: 'new-content',
      });
      expect(res).toBe('created');
    });

    it('sets issue labels', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [])
        .post('/api/v4/projects/undefined/issues')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'new-title',
        body: 'new-content',
        labels: ['Renovate', 'Maintenance'],
      });
      expect(res).toBe('created');
    });

    it('updates issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .get('/api/v4/projects/undefined/issues/2')
        .reply(200, { description: 'new-content' })
        .put('/api/v4/projects/undefined/issues/2')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBe('updated');
    });

    it('updates issue with labels', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .get('/api/v4/projects/undefined/issues/2')
        .reply(200, { description: 'new-content' })
        .put('/api/v4/projects/undefined/issues/2')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
        labels: ['Renovate', 'Maintenance'],
      });
      expect(res).toBe('updated');
    });

    it('skips update if unchanged', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .get('/api/v4/projects/undefined/issues/2')
        .reply(200, { description: 'newer-content' });
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBeNull();
    });

    it('creates confidential issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .post('/api/v4/projects/undefined/issues')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'new-title',
        body: 'new-content',
        confidential: true,
      });
      expect(res).toBe('created');
    });

    it('updates confidential issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .get('/api/v4/projects/undefined/issues/2')
        .reply(200, { description: 'new-content' })
        .put('/api/v4/projects/undefined/issues/2')
        .reply(200);
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
        labels: ['Renovate', 'Maintenance'],
        confidential: true,
      });
      expect(res).toBe('updated');
    });
  });

  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/issues?per_page=100&scope=created_by_me&state=opened'
        )
        .reply(200, [
          {
            iid: 1,
            title: 'title-1',
          },
          {
            iid: 2,
            title: 'title-2',
          },
        ])
        .put('/api/v4/projects/undefined/issues/2')
        .reply(200);
      await expect(gitlab.ensureIssueClosing('title-2')).toResolve();
    });
  });

  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignee to the issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users?username=someuser')
        .reply(200, [{ id: 123 }])
        .put('/api/v4/projects/undefined/merge_requests/42?assignee_ids[]=123')
        .reply(200);
      await expect(gitlab.addAssignees(42, ['someuser'])).toResolve();
    });

    it('should add the given assignees to the issue', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users?username=someuser')
        .reply(200, [{ id: 123 }])
        .get('/api/v4/users?username=someotheruser')
        .reply(200, [{ id: 124 }])
        .put(
          '/api/v4/projects/undefined/merge_requests/42?assignee_ids[]=123&assignee_ids[]=124'
        )
        .reply(200);
      await expect(
        gitlab.addAssignees(42, ['someuser', 'someotheruser'])
      ).toResolve();
    });

    it('should swallow error', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users?username=someuser')
        .replyWithError('some error');
      await expect(
        gitlab.addAssignees(42, ['someuser', 'someotheruser'])
      ).toResolve();
    });
  });

  describe('addReviewers(iid, reviewers)', () => {
    describe('13.8.0', () => {
      it('should not be supported in too low version', async () => {
        await initFakePlatform('13.8.0');
        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(logger.warn).toHaveBeenCalledWith(
          { version: '13.8.0' },
          'Adding reviewers is only available in GitLab 13.9 and onwards'
        );
      });
    });

    describe('13.9.0', () => {
      beforeEach(async () => {
        await initFakePlatform('13.9.0');
      });

      const existingReviewers = [
        { id: 1, username: 'foo' },
        { id: 2, username: 'bar' },
      ];

      it('should fail to get existing reviewers', async () => {
        const scope = httpMock
          .scope(gitlabApiHost)
          .get(
            '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
          )
          .reply(404);

        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(scope.isDone()).toBeTrue();
      });

      it('should fail to get user IDs', async () => {
        const scope = httpMock
          .scope(gitlabApiHost)
          .get(
            '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
          )
          .reply(200, { reviewers: existingReviewers })
          .get('/api/v4/users?username=someuser')
          .reply(200, [{ id: 10 }])
          .get('/api/v4/users?username=someotheruser')
          .reply(404);

        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(scope.isDone()).toBeTrue();
      });

      it('should fail to add reviewers to the MR', async () => {
        const scope = httpMock
          .scope(gitlabApiHost)
          .get(
            '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
          )
          .reply(200, { reviewers: existingReviewers })
          .get('/api/v4/users?username=someuser')
          .reply(200, [{ id: 10 }])
          .get('/api/v4/users?username=someotheruser')
          .reply(200, [{ id: 15 }])
          .put('/api/v4/projects/undefined/merge_requests/42', {
            reviewer_ids: [1, 2, 10, 15],
          })
          .reply(404);

        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(scope.isDone()).toBeTrue();
      });

      it('should add the given reviewers to the MR', async () => {
        const scope = httpMock
          .scope(gitlabApiHost)
          .get(
            '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
          )
          .reply(200, { reviewers: existingReviewers })
          .get('/api/v4/users?username=someuser')
          .reply(200, [{ id: 10 }])
          .get('/api/v4/users?username=someotheruser')
          .reply(200, [{ id: 15 }])
          .put('/api/v4/projects/undefined/merge_requests/42', {
            reviewer_ids: [1, 2, 10, 15],
          })
          .reply(200);

        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(scope.isDone()).toBeTrue();
      });

      it('should only add reviewers if necessary', async () => {
        const scope = httpMock
          .scope(gitlabApiHost)
          .get(
            '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
          )
          .reply(200, { reviewers: existingReviewers })
          .get('/api/v4/users?username=someuser')
          .reply(200, [{ id: 1 }])
          .get('/api/v4/users?username=someotheruser')
          .reply(200, [{ id: 2 }])
          .put('/api/v4/projects/undefined/merge_requests/42')
          .reply(200);

        await gitlab.addReviewers(42, ['someuser', 'foo', 'someotheruser']);
        expect(scope.isDone()).toBeTrue();
      });
    });
  });

  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [])
        .post('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200);
      await expect(
        gitlab.ensureComment({
          number: 42,
          topic: 'some-subject',
          content: 'some\ncontent',
        })
      ).toResolve();
    });

    it('add updates comment if necessary', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nblablabla' }])
        .put('/api/v4/projects/some%2Frepo/merge_requests/42/notes/1234')
        .reply(200);
      await expect(
        gitlab.ensureComment({
          number: 42,
          topic: 'some-subject',
          content: 'some\ncontent',
        })
      ).toResolve();
    });

    it('skips comment', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }]);
      await expect(
        gitlab.ensureComment({
          number: 42,
          topic: 'some-subject',
          content: 'some\ncontent',
        })
      ).toResolve();
    });

    it('handles comment with no description', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [{ id: 1234, body: '!merge' }]);
      await expect(
        gitlab.ensureComment({
          number: 42,
          topic: null,
          content: '!merge',
        })
      ).toResolve();
    });
  });

  describe('ensureCommentRemoval', () => {
    it('deletes comment by topic if found', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [{ id: 1234, body: '### some-subject\n\nblablabla' }])
        .delete('/api/v4/projects/some%2Frepo/merge_requests/42/notes/1234')
        .reply(200);
      await expect(
        gitlab.ensureCommentRemoval({
          type: 'by-topic',
          number: 42,
          topic: 'some-subject',
        })
      ).toResolve();
    });

    it('deletes comment by content if found', async () => {
      const scope = await initRepo();
      scope
        .get('/api/v4/projects/some%2Frepo/merge_requests/42/notes')
        .reply(200, [{ id: 1234, body: 'some-body\n' }])
        .delete('/api/v4/projects/some%2Frepo/merge_requests/42/notes/1234')
        .reply(200);
      await expect(
        gitlab.ensureCommentRemoval({
          type: 'by-content',
          number: 42,
          content: 'some-body',
        })
      ).toResolve();
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
      });
      expect(res).toBeDefined();
    });

    it('returns true if not open', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: PrState.Merged,
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        state: PrState.NotOpen,
      });
      expect(res).toBeDefined();
    });

    it('returns true if open and with title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: PrState.Open,
      });
      expect(res).toBeDefined();
    });

    it('returns true with title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: 'opened',
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeDefined();
    });

    it('returns true with draft prefix title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'Draft: branch a pr',
            state: 'opened',
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeDefined();
    });

    it('returns true with deprecated draft prefix title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'WIP: branch a pr',
            state: 'opened',
          },
        ]);
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeDefined();
    });
  });

  async function initPlatform(gitlabVersion: string) {
    httpMock
      .scope(gitlabApiHost)
      .get('/api/v4/user')
      .reply(200, {
        email: 'a@b.com',
        name: 'Renovate Bot',
      })
      .get('/api/v4/version')
      .reply(200, {
        version: gitlabVersion,
      });
    await gitlab.initPlatform({
      token: 'some-token',
      endpoint: undefined,
    });
  }

  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: null,
      });
      expect(pr).toMatchSnapshot();
    });

    it('uses default branch', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: [],
      });
      expect(pr).toMatchSnapshot();
    });

    it('supports draftPR on < 13.2', async () => {
      await initPlatform('13.1.0-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'WIP: some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        draftPR: true,
      });
      expect(pr).toMatchSnapshot();
    });

    it('supports draftPR on >= 13.2', async () => {
      await initPlatform('13.2.0-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'Draft: some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        draftPR: true,
      });
      expect(pr).toMatchSnapshot();
    });

    it('auto-accepts the MR when requested', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        })
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200, {
          merge_status: 'can_be_merged',
          pipeline: {
            id: 29626725,
            sha: '2be7ddb704c7b6b83732fdd5b9f09d5a397b5f8f',
            ref: 'patch-28',
            status: 'success',
          },
        })
        .put('/api/v4/projects/undefined/merge_requests/12345/merge')
        .reply(200);
      expect(
        await gitlab.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'master',
          prTitle: 'some-title',
          prBody: 'the-body',
          labels: [],
          platformOptions: {
            usePlatformAutomerge: true,
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "displayNumber": "Merge Request #12345",
          "id": 1,
          "iid": 12345,
          "number": 12345,
          "sourceBranch": "some-branch",
          "title": "some title",
        }
      `);
    });

    it('raises with squash enabled when repository squash option is default_on', async () => {
      await initPlatform('14.0.0');

      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, {
          squash_option: 'default_on',
          default_branch: 'master',
          url: 'https://some-url',
        });
      await gitlab.initRepo({
        repository: 'some/repo',
      });
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/some%2Frepo/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: null,
      });
      expect(pr).toMatchSnapshot();
    });

    it('raises with squash enabled when repository squash option is always', async () => {
      await initPlatform('14.0.0');

      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, {
          squash_option: 'always',
          default_branch: 'master',
          url: 'https://some-url',
        });
      await gitlab.initRepo({
        repository: 'some/repo',
      });
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/some%2Frepo/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        });
      const pr = await gitlab.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: null,
      });
      expect(pr).toMatchSnapshot();
    });

    it('adds approval rule to ignore all approvals', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        })
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200, {
          merge_status: 'can_be_merged',
          pipeline: {
            id: 29626725,
            sha: '2be7ddb704c7b6b83732fdd5b9f09d5a397b5f8f',
            ref: 'patch-28',
            status: 'success',
          },
        })
        .put('/api/v4/projects/undefined/merge_requests/12345/merge')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345/approval_rules')
        .reply(200, [])
        .post('/api/v4/projects/undefined/merge_requests/12345/approval_rules')
        .reply(200);
      expect(
        await gitlab.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'master',
          prTitle: 'some-title',
          prBody: 'the-body',
          labels: [],
          platformOptions: {
            usePlatformAutomerge: true,
            gitLabIgnoreApprovals: true,
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "displayNumber": "Merge Request #12345",
          "id": 1,
          "iid": 12345,
          "number": 12345,
          "sourceBranch": "some-branch",
          "title": "some title",
        }
      `);
    });

    it('does not try to create already existing approval rule', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        })
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200, {
          merge_status: 'can_be_merged',
          pipeline: {
            id: 29626725,
            sha: '2be7ddb704c7b6b83732fdd5b9f09d5a397b5f8f',
            ref: 'patch-28',
            status: 'success',
          },
        })
        .put('/api/v4/projects/undefined/merge_requests/12345/merge')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345/approval_rules')
        .reply(200, [
          { name: 'renovateIgnoreApprovals', approvals_required: 0 },
        ]);
      expect(
        await gitlab.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'master',
          prTitle: 'some-title',
          prBody: 'the-body',
          labels: [],
          platformOptions: {
            usePlatformAutomerge: true,
            gitLabIgnoreApprovals: true,
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "displayNumber": "Merge Request #12345",
          "id": 1,
          "iid": 12345,
          "number": 12345,
          "sourceBranch": "some-branch",
          "title": "some title",
        }
      `);
    });

    it('silently ignores approval rules adding errors', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .post('/api/v4/projects/undefined/merge_requests')
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some title',
        })
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345')
        .reply(200, {
          merge_status: 'can_be_merged',
          pipeline: {
            id: 29626725,
            sha: '2be7ddb704c7b6b83732fdd5b9f09d5a397b5f8f',
            ref: 'patch-28',
            status: 'success',
          },
        })
        .put('/api/v4/projects/undefined/merge_requests/12345/merge')
        .reply(200)
        .get('/api/v4/projects/undefined/merge_requests/12345/approval_rules')
        .reply(200, [])
        .post('/api/v4/projects/undefined/merge_requests/12345/approval_rules')
        .replyWithError('Unknown');
      expect(
        await gitlab.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'master',
          prTitle: 'some-title',
          prBody: 'the-body',
          labels: [],
          platformOptions: {
            usePlatformAutomerge: true,
            gitLabIgnoreApprovals: true,
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "displayNumber": "Merge Request #12345",
          "id": 1,
          "iid": 12345,
          "number": 12345,
          "sourceBranch": "some-branch",
          "title": "some title",
        }
      `);
    });
  });

  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests/12345?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'do something',
          description: 'a merge request',
          state: PrState.Merged,
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          target_branch: 'master',
          assignees: [],
        });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
      expect(pr?.hasAssignees).toBeFalse();
    });

    it('removes draft prefix from returned title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests/12345?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'Draft: do something',
          description: 'a merge request',
          state: PrState.Merged,
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          target_branch: 'master',
          assignees: [],
        });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
      expect(pr?.title).toBe('do something');
    });

    it('removes deprecated draft prefix from returned title', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests/12345?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'WIP: do something',
          description: 'a merge request',
          state: PrState.Merged,
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          target_branch: 'master',
          assignees: [],
        });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
      expect(pr?.title).toBe('do something');
    });

    it('returns the mergeable PR', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/merge_requests/12345?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'do something',
          description: 'a merge request',
          state: PrState.Open,
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          target_branch: 'master',
          assignee: {
            id: 1,
          },
        });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
      expect(pr?.hasAssignees).toBeTrue();
    });

    it('returns the PR with nonexisting branch', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests/12345?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'do something',
          description: 'a merge request',
          state: PrState.Open,
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 2,
          source_branch: 'some-branch',
          target_branch: 'master',
          assignees: [
            {
              id: 1,
            },
          ],
        });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
      expect(pr?.hasAssignees).toBeTrue();
    });
  });

  describe('updatePr(prNo, title, body)', () => {
    jest.resetAllMocks();

    it('updates the PR', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: PrState.Open,
          },
        ])
        .put('/api/v4/projects/undefined/merge_requests/1')
        .reply(200);
      await expect(
        gitlab.updatePr({ number: 1, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('retains draft status when draft uses current prefix', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'Draft: foo',
            state: PrState.Open,
          },
        ])
        .put('/api/v4/projects/undefined/merge_requests/1')
        .reply(200);
      await expect(
        gitlab.updatePr({ number: 1, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('retains draft status when draft uses deprecated prefix', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'WIP: foo',
            state: PrState.Open,
          },
        ])
        .put('/api/v4/projects/undefined/merge_requests/1')
        .reply(200);
      await expect(
        gitlab.updatePr({ number: 1, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('closes the PR', async () => {
      await initPlatform('13.3.6-ee');
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests?per_page=100&scope=created_by_me'
        )
        .reply(200, [
          {
            iid: 1,
            source_branch: 'branch-a',
            title: 'branch a pr',
            state: PrState.Open,
          },
        ])
        .put('/api/v4/projects/undefined/merge_requests/1')
        .reply(200);
      await expect(
        gitlab.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: PrState.Closed,
        })
      ).toResolve();
    });
  });

  describe('mergePr(pr)', () => {
    jest.resetAllMocks();

    it('merges the PR', async () => {
      httpMock
        .scope(gitlabApiHost)
        .put('/api/v4/projects/undefined/merge_requests/1/merge')
        .reply(200);
      expect(
        await gitlab.mergePr({
          id: 1,
        })
      ).toBeTrue();
    });
  });

  const prBody = `https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5

  Pull Requests are the best, here are some PRs.

  ## Open

These updates have all been created already. Click a checkbox below to force a retry/rebase of any.

 - [ ] <!-- rebase-branch=renovate/major-got-packages -->[build(deps): update got packages (major)](../pull/2433) (\`gh-got\`, \`gl-got\`, \`got\`)
`;

  describe('massageMarkdown(input)', () => {
    it('returns updated pr body', async () => {
      jest.mock('../utils/pr-body');
      const { smartTruncate } = require('../utils/pr-body');

      await initFakePlatform('13.4.0');
      expect(gitlab.massageMarkdown(prBody)).toMatchSnapshot();
      expect(smartTruncate).not.toHaveBeenCalled();
    });

    it('truncates description if too low API version', async () => {
      jest.mock('../utils/pr-body');
      const { smartTruncate } = require('../utils/pr-body');

      await initFakePlatform('13.3.0');
      gitlab.massageMarkdown(prBody);
      expect(smartTruncate).toHaveBeenCalledTimes(1);
      expect(smartTruncate).toHaveBeenCalledWith(expect.any(String), 25000);
    });

    it('truncates description for API version gt 13.4', async () => {
      jest.mock('../utils/pr-body');
      const { smartTruncate } = require('../utils/pr-body');

      await initFakePlatform('13.4.1');
      gitlab.massageMarkdown(prBody);
      expect(smartTruncate).toHaveBeenCalledTimes(1);
      expect(smartTruncate).toHaveBeenCalledWith(expect.any(String), 1000000);
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
      httpMock
        .scope(gitlabApiHost)
        .get(
          '/api/v4/projects/undefined/merge_requests/42?include_diverged_commits_count=1'
        )
        .reply(200, {
          id: 1,
          iid: 12345,
          title: 'some change',
          description: 'a merge request',
          state: PrState.Merged,
          merge_status: 'cannot_be_merged',
          diverged_commits_count: 5,
          source_branch: 'some-branch',
          labels: ['foo', 'renovate', 'rebase'],
        })
        .put('/api/v4/projects/undefined/merge_requests/42')
        .reply(200);
      await expect(gitlab.deleteLabel(42, 'rebase')).toResolve();
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/dir%2Ffile.json?ref=HEAD'
        )
        .reply(200, {
          content: toBase64(JSON.stringify(data)),
        });
      const res = await gitlab.getJsonFile('dir/file.json');
      expect(res).toEqual(data);
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
        `;
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/dir%2Ffile.json5?ref=HEAD'
        )
        .reply(200, {
          content: toBase64(json5Data),
        });
      const res = await gitlab.getJsonFile('dir/file.json5');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns file content from given repo', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/different%2Frepo/repository/files/dir%2Ffile.json?ref=HEAD'
        )
        .reply(200, {
          content: toBase64(JSON.stringify(data)),
        });
      const res = await gitlab.getJsonFile('dir/file.json', 'different%2Frepo');
      expect(res).toEqual(data);
    });

    it('returns file content from branch or tag', async () => {
      const data = { foo: 'bar' };
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/dir%2Ffile.json?ref=dev'
        )
        .reply(200, {
          content: toBase64(JSON.stringify(data)),
        });
      const res = await gitlab.getJsonFile(
        'dir/file.json',
        'some%2Frepo',
        'dev'
      );
      expect(res).toEqual(data);
    });

    it('throws on malformed JSON', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/dir%2Ffile.json?ref=HEAD'
        )
        .reply(200, {
          content: toBase64('!@#'),
        });
      await expect(gitlab.getJsonFile('dir/file.json')).rejects.toThrow();
    });

    it('throws on errors', async () => {
      const scope = await initRepo();
      scope
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/dir%2Ffile.json?ref=HEAD'
        )
        .replyWithError('some error');
      await expect(gitlab.getJsonFile('dir/file.json')).rejects.toThrow();
    });
  });

  describe('filterUnavailableUsers(users)', () => {
    it('filters users that are busy', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users/maria/status')
        .reply(200, {
          availability: 'busy',
        })
        .get('/api/v4/users/john/status')
        .reply(200, {
          availability: 'not_set',
        });
      const filteredUsers = await gitlab.filterUnavailableUsers?.([
        'maria',
        'john',
      ]);
      expect(filteredUsers).toEqual(['john']);
    });

    it('keeps users with missing availability', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users/maria/status')
        .reply(200, {});
      const filteredUsers = await gitlab.filterUnavailableUsers?.(['maria']);
      expect(filteredUsers).toEqual(['maria']);
    });

    it('keeps users with failing requests', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/users/maria/status')
        .reply(404);
      const filteredUsers = await gitlab.filterUnavailableUsers?.(['maria']);
      expect(filteredUsers).toEqual(['maria']);
    });
  });
});
