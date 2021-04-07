import { BranchStatusConfig, Platform, RepoParams, RepoResult } from '..';
import { getName, partial } from '../../../test/util';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../constants/error-messages';
import { logger as _logger } from '../../logger';
import { BranchStatus, PrState } from '../../types';
import * as _git from '../../util/git';
import { setBaseUrl } from '../../util/http/gitea';
import { PlatformResult } from '../types';
import * as ght from './gitea-helper';

/**
 * latest tested gitea version.
 */
const GITEA_VERSION = '1.14.0+dev-754-g5d2b7ba63';

describe(getName(__filename), () => {
  let gitea: Platform;
  let helper: jest.Mocked<typeof import('./gitea-helper')>;
  let logger: jest.Mocked<typeof _logger>;
  let gitvcs: jest.Mocked<typeof _git>;

  const mockCommitHash = '0d9c7726c3d628b7e28af234595cfd20febdbf8e';

  const mockUser: ght.User = {
    id: 1,
    username: 'renovate',
    full_name: 'Renovate Bot',
    email: 'renovate@example.com',
  };

  const mockRepo = partial<ght.Repo>({
    allow_rebase: true,
    clone_url: 'https://gitea.renovatebot.com/some/repo.git',
    default_branch: 'master',
    full_name: 'some/repo',
    permissions: {
      pull: true,
      push: true,
      admin: false,
    },
  });

  const mockRepos: ght.Repo[] = [
    partial<ght.Repo>({ full_name: 'a/b' }),
    partial<ght.Repo>({ full_name: 'c/d' }),
  ];

  const mockPRs: ght.PR[] = [
    partial<ght.PR>({
      number: 1,
      title: 'Some PR',
      body: 'some random pull request',
      state: PrState.Open,
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/1.diff',
      created_at: '2015-03-22T20:36:16Z',
      closed_at: null,
      mergeable: true,
      base: { ref: 'some-base-branch' },
      head: {
        label: 'some-head-branch',
        sha: 'some-head-sha',
        repo: partial<ght.Repo>({ full_name: mockRepo.full_name }),
      },
    }),
    partial<ght.PR>({
      number: 2,
      title: 'Other PR',
      body: 'other random pull request',
      state: PrState.Closed,
      diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/2.diff',
      created_at: '2011-08-18T22:30:38Z',
      closed_at: '2016-01-09T10:03:21Z',
      mergeable: true,
      base: { ref: 'other-base-branch' },
      head: {
        label: 'other-head-branch',
        sha: 'other-head-sha',
        repo: partial<ght.Repo>({ full_name: mockRepo.full_name }),
      },
    }),
  ];

  const mockIssues: ght.Issue[] = [
    {
      number: 1,
      title: 'open-issue',
      state: 'open',
      body: 'some-content',
      assignees: [],
    },
    {
      number: 2,
      title: 'closed-issue',
      state: 'closed',
      body: 'other-content',
      assignees: [],
    },
    {
      number: 3,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
    },
    {
      number: 4,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
    },
    {
      number: 5,
      title: 'duplicate-issue',
      state: 'open',
      body: 'duplicate-content',
      assignees: [],
    },
  ];

  const mockComments: ght.Comment[] = [
    { id: 1, body: 'some-body' },
    { id: 2, body: 'other-body' },
    { id: 3, body: '### some-topic\n\nsome-content' },
  ];

  const mockRepoLabels: ght.Label[] = [
    { id: 1, name: 'some-label', description: 'its a me', color: '#000000' },
    { id: 2, name: 'other-label', description: 'labelario', color: '#ffffff' },
  ];

  const mockOrgLabels: ght.Label[] = [
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
    jest.clearAllMocks();
    jest.mock('./gitea-helper');
    jest.mock('../../util/git');
    jest.mock('../../logger');

    gitea = await import('.');
    helper = (await import('./gitea-helper')) as any;
    logger = (await import('../../logger')).logger as any;
    gitvcs = require('../../util/git');
    gitvcs.isBranchStale.mockResolvedValue(false);
    gitvcs.getBranchCommit.mockReturnValue(mockCommitHash);

    global.gitAuthor = { name: 'Renovate', email: 'renovate@example.com' };

    setBaseUrl('https://gitea.renovatebot.com/api/v1');
  });

  function initFakePlatform(version = GITEA_VERSION): Promise<PlatformResult> {
    helper.getCurrentUser.mockResolvedValueOnce(mockUser);
    helper.getVersion.mockResolvedValueOnce(version);
    return gitea.initPlatform({ token: 'abc' });
  }

  function initFakeRepo(
    repo?: Partial<ght.Repo>,
    config?: Partial<RepoParams>
  ): Promise<RepoResult> {
    helper.getRepo.mockResolvedValueOnce({ ...mockRepo, ...repo });

    return gitea.initRepo({
      repository: mockRepo.full_name,
      localDir: '',
      ...config,
    });
  }

  describe('initPlatform()', () => {
    it('should throw if no token', async () => {
      await expect(gitea.initPlatform({})).rejects.toThrow();
    });

    it('should throw if auth fails', async () => {
      helper.getCurrentUser.mockRejectedValueOnce(new Error());

      await expect(
        gitea.initPlatform({ token: 'some-token' })
      ).rejects.toThrow();
    });

    it('should support default endpoint', async () => {
      helper.getCurrentUser.mockResolvedValueOnce(mockUser);

      expect(
        await gitea.initPlatform({ token: 'some-token' })
      ).toMatchSnapshot();
    });

    it('should support custom endpoint', async () => {
      helper.getCurrentUser.mockResolvedValueOnce(mockUser);

      expect(
        await gitea.initPlatform({
          token: 'some-token',
          endpoint: 'https://gitea.renovatebot.com',
        })
      ).toMatchSnapshot();
    });

    it('should use username as author name if full name is missing', async () => {
      helper.getCurrentUser.mockResolvedValueOnce({
        ...mockUser,
        full_name: undefined,
      });

      expect(
        await gitea.initPlatform({ token: 'some-token' })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    it('should propagate any other errors', async () => {
      helper.searchRepos.mockRejectedValueOnce(new Error('searchRepos()'));

      await expect(gitea.getRepos()).rejects.toThrow('searchRepos()');
    });

    it('should return an array of repos', async () => {
      helper.searchRepos.mockResolvedValueOnce(mockRepos);

      const repos = await gitea.getRepos();
      expect(repos).toMatchSnapshot();
    });
  });

  describe('initRepo', () => {
    const initRepoCfg: RepoParams = {
      repository: mockRepo.full_name,
      localDir: '',
    };

    it('should propagate API errors', async () => {
      helper.getRepo.mockRejectedValueOnce(new Error('getRepo()'));

      await expect(gitea.initRepo(initRepoCfg)).rejects.toThrow('getRepo()');
    });

    it('should abort when repo is archived', async () => {
      await expect(initFakeRepo({ archived: true })).rejects.toThrow(
        REPOSITORY_ARCHIVED
      );
    });

    it('should abort when repo is mirrored', async () => {
      await expect(initFakeRepo({ mirror: true })).rejects.toThrow(
        REPOSITORY_MIRRORED
      );
    });

    it('should abort when repo is empty', async () => {
      await expect(initFakeRepo({ empty: true })).rejects.toThrow(
        REPOSITORY_EMPTY
      );
    });

    it('should abort when repo has insufficient permissions', async () => {
      await expect(
        initFakeRepo({
          permissions: {
            pull: false,
            push: false,
            admin: false,
          },
        })
      ).rejects.toThrow(REPOSITORY_ACCESS_FORBIDDEN);
    });

    it('should abort when repo has no available merge methods', async () => {
      await expect(initFakeRepo({ allow_rebase: false })).rejects.toThrow(
        REPOSITORY_BLOCKED
      );
    });

    it('should fall back to merge method "rebase-merge"', async () => {
      expect(
        await initFakeRepo({ allow_rebase: false, allow_rebase_explicit: true })
      ).toMatchSnapshot();
    });

    it('should fall back to merge method "squash"', async () => {
      expect(
        await initFakeRepo({ allow_rebase: false, allow_squash_merge: true })
      ).toMatchSnapshot();
    });

    it('should fall back to merge method "merge"', async () => {
      expect(
        await initFakeRepo({
          allow_rebase: false,
          allow_merge_commits: true,
        })
      ).toMatchSnapshot();
    });
  });

  describe('setBranchStatus', () => {
    const setBranchStatus = async (bsc?: Partial<BranchStatusConfig>) => {
      await initFakeRepo();
      await gitea.setBranchStatus({
        branchName: 'some-branch',
        state: BranchStatus.green,
        context: 'some-context',
        description: 'some-description',
        ...bsc,
      });
    };

    it('should create a new commit status', async () => {
      await setBranchStatus();

      expect(helper.createCommitStatus).toHaveBeenCalledTimes(1);
      expect(helper.createCommitStatus).toHaveBeenCalledWith(
        mockRepo.full_name,
        mockCommitHash,
        {
          state: 'success',
          context: 'some-context',
          description: 'some-description',
        }
      );
    });

    it('should default to pending state', async () => {
      await setBranchStatus({ state: undefined });

      expect(helper.createCommitStatus).toHaveBeenCalledTimes(1);
      expect(helper.createCommitStatus).toHaveBeenCalledWith(
        mockRepo.full_name,
        mockCommitHash,
        {
          state: 'pending',
          context: 'some-context',
          description: 'some-description',
        }
      );
    });

    it('should include url if specified', async () => {
      await setBranchStatus({ url: 'some-url' });

      expect(helper.createCommitStatus).toHaveBeenCalledTimes(1);
      expect(helper.createCommitStatus).toHaveBeenCalledWith(
        mockRepo.full_name,
        mockCommitHash,
        {
          state: 'success',
          context: 'some-context',
          description: 'some-description',
          target_url: 'some-url',
        }
      );
    });

    it('should gracefully fail with warning', async () => {
      helper.createCommitStatus.mockRejectedValueOnce(new Error());
      await setBranchStatus();

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBranchStatus', () => {
    const getBranchStatus = async (state: string): Promise<BranchStatus> => {
      await initFakeRepo();
      helper.getCombinedCommitStatus.mockResolvedValueOnce(
        partial<ght.CombinedCommitStatus>({
          worstStatus: state as ght.CommitStatusType,
        })
      );

      return gitea.getBranchStatus('some-branch', []);
    };

    it('should return success if requiredStatusChecks null', async () => {
      expect(await gitea.getBranchStatus('some-branch', null)).toEqual(
        BranchStatus.green
      );
    });

    it('should return failed if unsupported requiredStatusChecks', async () => {
      expect(await gitea.getBranchStatus('some-branch', ['foo'])).toEqual(
        BranchStatus.red
      );
    });

    it('should return yellow for unknown result', async () => {
      expect(await getBranchStatus('unknown')).toEqual(BranchStatus.yellow);
    });

    it('should return pending state for pending result', async () => {
      expect(await getBranchStatus('pending')).toEqual(BranchStatus.yellow);
    });

    it('should return success state for success result', async () => {
      expect(await getBranchStatus('success')).toEqual(BranchStatus.green);
    });

    it('should return null for all other results', async () => {
      expect(await getBranchStatus('invalid')).toEqual(BranchStatus.yellow);
    });

    it('should abort when branch status returns 404', async () => {
      helper.getCombinedCommitStatus.mockRejectedValueOnce({ statusCode: 404 });

      await expect(gitea.getBranchStatus('some-branch', [])).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });

    it('should propagate any other errors', async () => {
      helper.getCombinedCommitStatus.mockRejectedValueOnce(
        new Error('getCombinedCommitStatus()')
      );

      await expect(gitea.getBranchStatus('some-branch', [])).rejects.toThrow(
        'getCombinedCommitStatus()'
      );
    });
  });

  describe('getBranchStatusCheck', () => {
    it('should return null with no results', async () => {
      helper.getCombinedCommitStatus.mockResolvedValueOnce(
        partial<ght.CombinedCommitStatus>({
          statuses: [],
        })
      );

      expect(
        await gitea.getBranchStatusCheck('some-branch', 'some-context')
      ).toBeNull();
    });

    it('should return null with no matching results', async () => {
      helper.getCombinedCommitStatus.mockResolvedValueOnce(
        partial<ght.CombinedCommitStatus>({
          statuses: [partial<ght.CommitStatus>({ context: 'other-context' })],
        })
      );

      expect(
        await gitea.getBranchStatusCheck('some-branch', 'some-context')
      ).toBeNull();
    });
    it('should return yellow with unknown status', async () => {
      helper.getCombinedCommitStatus.mockResolvedValueOnce(
        partial<ght.CombinedCommitStatus>({
          statuses: [
            partial<ght.CommitStatus>({
              context: 'some-context',
            }),
          ],
        })
      );

      expect(
        await gitea.getBranchStatusCheck('some-branch', 'some-context')
      ).toEqual(BranchStatus.yellow);
    });

    it('should return green of matching result', async () => {
      helper.getCombinedCommitStatus.mockResolvedValueOnce(
        partial<ght.CombinedCommitStatus>({
          statuses: [
            partial<ght.CommitStatus>({
              status: 'success',
              context: 'some-context',
            }),
          ],
        })
      );

      expect(
        await gitea.getBranchStatusCheck('some-branch', 'some-context')
      ).toEqual(BranchStatus.green);
    });
  });

  describe('getPrList', () => {
    it('should return list of pull requests', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.getPrList();
      expect(res).toHaveLength(mockPRs.length);
      expect(res).toMatchSnapshot();
    });

    it('should filter list by creator', async () => {
      helper.getCurrentUser.mockResolvedValueOnce(mockUser);

      expect(
        await gitea.initPlatform({ token: 'some-token' })
      ).toMatchSnapshot();

      await initFakeRepo();

      helper.searchPRs.mockResolvedValueOnce([
        partial<ght.PR>({
          number: 3,
          title: 'Third-party PR',
          body: 'other random pull request',
          state: PrState.Open,
          diff_url: 'https://gitea.renovatebot.com/some/repo/pulls/3.diff',
          created_at: '2011-08-18T22:30:38Z',
          closed_at: '2016-01-09T10:03:21Z',
          mergeable: true,
          base: { ref: 'third-party-base-branch' },
          head: {
            label: 'other-head-branch',
            sha: 'other-head-sha',
            repo: partial<ght.Repo>({ full_name: mockRepo.full_name }),
          },
          user: { username: 'not-renovate' },
        }),
        ...mockPRs.map((pr) => ({ ...pr, user: { username: 'renovate' } })),
      ]);

      const res = await gitea.getPrList();
      expect(res).toHaveLength(mockPRs.length);
      expect(res).toMatchSnapshot();
    });

    it('should cache results after first query', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res1 = await gitea.getPrList();
      const res2 = await gitea.getPrList();
      expect(res1).toEqual(res2);
      expect(helper.searchPRs).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPr', () => {
    it('should return enriched pull request which exists if open', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      helper.getBranch.mockResolvedValueOnce(
        partial<ght.Branch>({
          commit: {
            id: mockCommitHash,
            author: partial<ght.CommitUser>({ email: global.gitAuthor.email }),
          },
        })
      );
      await initFakeRepo();

      const res = await gitea.getPr(mockPR.number);
      expect(res).toHaveProperty('number', mockPR.number);
      expect(res).toMatchSnapshot();
    });

    it('should fallback to direct fetching if cache fails', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce([]);
      helper.getPR.mockResolvedValueOnce(mockPR);
      await initFakeRepo();

      const res = await gitea.getPr(mockPR.number);
      expect(res).toHaveProperty('number', mockPR.number);
      expect(res).toMatchSnapshot();
      expect(helper.getPR).toHaveBeenCalledTimes(1);
    });

    it('should return null for missing pull request', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      expect(await gitea.getPr(42)).toBeNull();
    });

    it('should block modified pull request for rebasing', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.getPr(mockPR.number);
      expect(res).toHaveProperty('number', mockPR.number);
    });
  });

  describe('findPr', () => {
    it('should find pull request without title or state', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.findPr({ branchName: mockPR.head.label });
      expect(res).toHaveProperty('sourceBranch', mockPR.head.label);
    });

    it('should find pull request with title', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.findPr({
        branchName: mockPR.head.label,
        prTitle: mockPR.title,
      });
      expect(res).toHaveProperty('sourceBranch', mockPR.head.label);
      expect(res).toHaveProperty('title', mockPR.title);
    });

    it('should find pull request with state', async () => {
      const mockPR = mockPRs[1];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.findPr({
        branchName: mockPR.head.label,
        state: mockPR.state,
      });
      expect(res).toHaveProperty('sourceBranch', mockPR.head.label);
      expect(res).toHaveProperty('state', mockPR.state);
    });

    it('should not find pull request with inverted state', async () => {
      const mockPR = mockPRs[1];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      expect(
        await gitea.findPr({
          branchName: mockPR.head.label,
          state: `!${mockPR.state}` as ght.PRState,
        })
      ).toBeNull();
    });

    it('should find pull request with title and state', async () => {
      const mockPR = mockPRs[1];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      const res = await gitea.findPr({
        branchName: mockPR.head.label,
        prTitle: mockPR.title,
        state: mockPR.state,
      });
      expect(res).toHaveProperty('sourceBranch', mockPR.head.label);
      expect(res).toHaveProperty('title', mockPR.title);
      expect(res).toHaveProperty('state', mockPR.state);
    });

    it('should return null for missing pull request', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      expect(await gitea.findPr({ branchName: 'missing' })).toBeNull();
    });
  });

  describe('createPr', () => {
    const mockNewPR: ght.PR = {
      number: 42,
      state: PrState.Open,
      head: {
        label: 'pr-branch',
        sha: mockCommitHash,
        repo: partial<ght.Repo>({ full_name: mockRepo.full_name }),
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
    };

    it('should use base branch by default', async () => {
      helper.createPR.mockResolvedValueOnce({
        ...mockNewPR,
        base: { ref: 'devel' },
      });

      await initFakeRepo();
      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'devel',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });

      expect(res).toHaveProperty('number', mockNewPR.number);
      expect(res).toHaveProperty('targetBranch', 'devel');
      expect(res).toMatchSnapshot();
      expect(helper.createPR).toHaveBeenCalledTimes(1);
      expect(helper.createPR).toHaveBeenCalledWith(mockRepo.full_name, {
        base: 'devel',
        head: mockNewPR.head.label,
        title: mockNewPR.title,
        body: mockNewPR.body,
        labels: [],
      });
    });

    it('should use default branch if requested', async () => {
      helper.createPR.mockResolvedValueOnce(mockNewPR);

      await initFakeRepo();
      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });

      expect(res).toHaveProperty('number', mockNewPR.number);
      expect(res).toHaveProperty('targetBranch', mockNewPR.base.ref);
      expect(res).toMatchSnapshot();
      expect(helper.createPR).toHaveBeenCalledTimes(1);
      expect(helper.createPR).toHaveBeenCalledWith(mockRepo.full_name, {
        base: mockNewPR.base.ref,
        head: mockNewPR.head.label,
        title: mockNewPR.title,
        body: mockNewPR.body,
        labels: [],
      });
    });

    it('should resolve and apply optional labels to pull request', async () => {
      helper.createPR.mockResolvedValueOnce(mockNewPR);
      helper.getRepoLabels.mockResolvedValueOnce(mockRepoLabels);
      helper.getOrgLabels.mockResolvedValueOnce(mockOrgLabels);

      const mockLabels = mockRepoLabels.concat(mockOrgLabels);

      await initFakeRepo();
      await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
        labels: mockLabels.map((l) => l.name),
      });

      expect(helper.createPR).toHaveBeenCalledTimes(1);
      expect(helper.createPR).toHaveBeenCalledWith(mockRepo.full_name, {
        base: mockNewPR.base.ref,
        head: mockNewPR.head.label,
        title: mockNewPR.title,
        body: mockNewPR.body,
        labels: mockLabels.map((l) => l.id),
      });
    });

    it('should ensure new pull request gets added to cached pull requests', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      helper.createPR.mockResolvedValueOnce(mockNewPR);

      await initFakeRepo();
      await gitea.getPrList();
      await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });
      const res = gitea.getPr(mockNewPR.number);

      expect(res).not.toBeNull();
      expect(helper.searchPRs).toHaveBeenCalledTimes(1);
    });

    it('should attempt to resolve 409 conflict error (w/o update)', async () => {
      helper.createPR.mockRejectedValueOnce({ statusCode: 409 });
      helper.searchPRs.mockResolvedValueOnce([mockNewPR]);

      await initFakeRepo();
      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: mockNewPR.title,
        prBody: mockNewPR.body,
      });

      expect(res).toHaveProperty('number', mockNewPR.number);
    });

    it('should attempt to resolve 409 conflict error (w/ update)', async () => {
      helper.createPR.mockRejectedValueOnce({ statusCode: 409 });
      helper.searchPRs.mockResolvedValueOnce([mockNewPR]);

      await initFakeRepo();
      const res = await gitea.createPr({
        sourceBranch: mockNewPR.head.label,
        targetBranch: 'master',
        prTitle: 'new-title',
        prBody: 'new-body',
      });

      expect(res).toHaveProperty('number', mockNewPR.number);
      expect(helper.updatePR).toHaveBeenCalledTimes(1);
      expect(helper.updatePR).toHaveBeenCalledWith(
        mockRepo.full_name,
        mockNewPR.number,
        { title: 'new-title', body: 'new-body' }
      );
    });

    it('should abort when response for created pull request is invalid', async () => {
      helper.createPR.mockResolvedValueOnce(partial<ght.PR>({}));

      await initFakeRepo();
      await expect(
        gitea.createPr({
          sourceBranch: mockNewPR.head.label,
          targetBranch: 'master',
          prTitle: mockNewPR.title,
          prBody: mockNewPR.body,
        })
      ).rejects.toThrow();
    });
  });

  describe('updatePr', () => {
    it('should update pull request with title', async () => {
      await initFakeRepo();
      await gitea.updatePr({ number: 1, prTitle: 'New Title' });

      expect(helper.updatePR).toHaveBeenCalledTimes(1);
      expect(helper.updatePR).toHaveBeenCalledWith(mockRepo.full_name, 1, {
        title: 'New Title',
      });
    });

    it('should update pull request with title and body', async () => {
      await initFakeRepo();
      await gitea.updatePr({
        number: 1,
        prTitle: 'New Title',
        prBody: 'New Body',
      });

      expect(helper.updatePR).toHaveBeenCalledTimes(1);
      expect(helper.updatePR).toHaveBeenCalledWith(mockRepo.full_name, 1, {
        title: 'New Title',
        body: 'New Body',
      });
    });

    it('should close pull request', async () => {
      await initFakeRepo();
      await gitea.updatePr({
        number: 1,
        prTitle: 'New Title',
        prBody: 'New Body',
        state: PrState.Closed,
      });

      expect(helper.updatePR).toHaveBeenCalledWith(mockRepo.full_name, 1, {
        title: 'New Title',
        body: 'New Body',
        state: PrState.Closed,
      });
    });
  });

  describe('mergePr', () => {
    it('should return true when merging succeeds', async () => {
      await initFakeRepo();

      expect(await gitea.mergePr(1, 'some-branch')).toEqual(true);
      expect(helper.mergePR).toHaveBeenCalledTimes(1);
      expect(helper.mergePR).toHaveBeenCalledWith(
        mockRepo.full_name,
        1,
        'rebase'
      );
    });

    it('should return false when merging fails', async () => {
      helper.mergePR.mockRejectedValueOnce(new Error());
      await initFakeRepo();

      expect(await gitea.mergePr(1, 'some-branch')).toEqual(false);
    });
  });

  describe('findIssue', () => {
    it('should return existing open issue', async () => {
      const mockIssue = mockIssues.find((i) => i.title === 'open-issue');
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      await initFakeRepo();

      expect(await gitea.findIssue(mockIssue.title)).toHaveProperty(
        'number',
        mockIssue.number
      );
    });

    it('should not return existing closed issue', async () => {
      const mockIssue = mockIssues.find((i) => i.title === 'closed-issue');
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      await initFakeRepo();

      expect(await gitea.findIssue(mockIssue.title)).toBeNull();
    });

    it('should return null for missing issue', async () => {
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      await initFakeRepo();

      expect(await gitea.findIssue('missing')).toBeNull();
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

      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      helper.createIssue.mockResolvedValueOnce(
        partial<ght.Issue>({ number: 42 })
      );

      await initFakeRepo();
      const res = await gitea.ensureIssue(mockIssue);

      expect(res).toEqual('created');
      expect(helper.createIssue).toHaveBeenCalledTimes(1);
      expect(helper.createIssue).toHaveBeenCalledWith(mockRepo.full_name, {
        body: mockIssue.body,
        title: mockIssue.title,
      });
    });

    it('should not reopen closed issue by default', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue');
      helper.searchIssues.mockResolvedValueOnce(mockIssues);

      await initFakeRepo();
      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: false,
        once: false,
      });

      expect(res).toEqual('updated');
      expect(helper.updateIssue).toHaveBeenCalledTimes(1);
      expect(helper.updateIssue).toHaveBeenCalledWith(
        mockRepo.full_name,
        closedIssue.number,
        {
          body: closedIssue.body,
          state: closedIssue.state,
          title: 'closed-issue',
        }
      );
    });

    it('should reopen closed issue if desired', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue');
      helper.searchIssues.mockResolvedValueOnce(mockIssues);

      await initFakeRepo();
      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: true,
        once: false,
      });

      expect(res).toEqual('updated');
      expect(helper.updateIssue).toHaveBeenCalledTimes(1);
      expect(helper.updateIssue).toHaveBeenCalledWith(
        mockRepo.full_name,
        closedIssue.number,
        {
          body: closedIssue.body,
          state: 'open',
          title: 'closed-issue',
        }
      );
    });

    it('should not update existing closed issue if desired', async () => {
      const closedIssue = mockIssues.find((i) => i.title === 'closed-issue');
      helper.searchIssues.mockResolvedValueOnce(mockIssues);

      await initFakeRepo();
      const res = await gitea.ensureIssue({
        title: closedIssue.title,
        body: closedIssue.body,
        shouldReOpen: false,
        once: true,
      });

      expect(res).toBeNull();
      expect(helper.updateIssue).not.toHaveBeenCalled();
    });

    it('should close all open duplicate issues except first one when updating', async () => {
      const duplicates = mockIssues.filter(
        (i) => i.title === 'duplicate-issue'
      );
      const firstDuplicate = duplicates[0];
      helper.searchIssues.mockResolvedValueOnce(duplicates);

      await initFakeRepo();
      const res = await gitea.ensureIssue({
        title: firstDuplicate.title,
        body: firstDuplicate.body,
        shouldReOpen: false,
        once: false,
      });

      expect(res).toBeNull();
      expect(helper.closeIssue).toHaveBeenCalledTimes(duplicates.length - 1);
      for (const issue of duplicates) {
        if (issue.number !== firstDuplicate.number) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(helper.closeIssue).toHaveBeenCalledWith(
            mockRepo.full_name,
            issue.number
          );
        }
      }
      expect(helper.updateIssue).not.toHaveBeenCalled();
    });

    it('should reset issue cache when creating an issue', async () => {
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      helper.createIssue.mockResolvedValueOnce(
        partial<ght.Issue>({ number: 42 })
      );

      await initFakeRepo();
      await gitea.ensureIssue({
        title: 'new-title',
        body: 'new-body',
        shouldReOpen: false,
        once: false,
      });
      await gitea.getIssueList();

      expect(helper.searchIssues).toHaveBeenCalledTimes(2);
    });

    it('should gracefully fail with warning', async () => {
      helper.searchIssues.mockRejectedValueOnce(new Error());
      await initFakeRepo();
      await gitea.ensureIssue({
        title: 'new-title',
        body: 'new-body',
        shouldReOpen: false,
        once: false,
      });

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureIssueClosing', () => {
    it('should close issues with matching title', async () => {
      const mockIssue = mockIssues[0];
      helper.searchIssues.mockResolvedValueOnce(mockIssues);
      await initFakeRepo();
      await gitea.ensureIssueClosing(mockIssue.title);

      expect(helper.closeIssue).toHaveBeenCalledTimes(1);
      expect(helper.closeIssue).toHaveBeenCalledWith(
        mockRepo.full_name,
        mockIssue.number
      );
    });
  });

  describe('deleteLabel', () => {
    it('should delete a label which exists', async () => {
      const mockLabel = mockRepoLabels[0];
      helper.getRepoLabels.mockResolvedValueOnce(mockRepoLabels);
      helper.getOrgLabels.mockRejectedValueOnce(new Error());
      await initFakeRepo();
      await gitea.deleteLabel(42, mockLabel.name);

      expect(helper.unassignLabel).toHaveBeenCalledTimes(1);
      expect(helper.unassignLabel).toHaveBeenCalledWith(
        mockRepo.full_name,
        42,
        mockLabel.id
      );
    });

    it('should gracefully fail with warning if label is missing', async () => {
      helper.getRepoLabels.mockResolvedValueOnce(mockRepoLabels);
      helper.getOrgLabels.mockResolvedValueOnce([]);
      await initFakeRepo();
      await gitea.deleteLabel(42, 'missing');

      expect(helper.unassignLabel).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRepoForceRebase', () => {
    it('should return false - unsupported by platform', async () => {
      expect(await gitea.getRepoForceRebase()).toEqual(false);
    });
  });

  describe('ensureComment', () => {
    it('should add comment with topic if not found', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      helper.createComment.mockResolvedValueOnce(
        partial<ght.Comment>({ id: 42 })
      );

      await initFakeRepo();
      const res = await gitea.ensureComment({
        number: 1,
        topic: 'other-topic',
        content: 'other-content',
      });
      const body = '### other-topic\n\nother-content';

      expect(res).toEqual(true);
      expect(helper.updateComment).not.toHaveBeenCalled();
      expect(helper.createComment).toHaveBeenCalledTimes(1);
      expect(helper.createComment).toHaveBeenCalledWith(
        mockRepo.full_name,
        1,
        body
      );
    });

    it('should add comment without topic if not found', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      helper.createComment.mockResolvedValueOnce(
        partial<ght.Comment>({ id: 42 })
      );

      await initFakeRepo();
      const res = await gitea.ensureComment({
        number: 1,
        content: 'other-content',
        topic: undefined,
      });

      expect(res).toEqual(true);
      expect(helper.updateComment).not.toHaveBeenCalled();
      expect(helper.createComment).toHaveBeenCalledTimes(1);
      expect(helper.createComment).toHaveBeenCalledWith(
        mockRepo.full_name,
        1,
        'other-content'
      );
    });

    it('should update comment with topic if found', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      helper.updateComment.mockResolvedValueOnce(
        partial<ght.Comment>({ id: 42 })
      );

      await initFakeRepo();
      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-new-content',
      });
      const body = '### some-topic\n\nsome-new-content';

      expect(res).toEqual(true);
      expect(helper.createComment).not.toHaveBeenCalled();
      expect(helper.updateComment).toHaveBeenCalledTimes(1);
      expect(helper.updateComment).toHaveBeenCalledWith(
        mockRepo.full_name,
        1,
        body
      );
    });

    it('should skip if comment is up-to-date', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      await initFakeRepo();
      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-content',
      });

      expect(res).toEqual(true);
      expect(helper.createComment).not.toHaveBeenCalled();
      expect(helper.updateComment).not.toHaveBeenCalled();
    });

    it('should gracefully fail with warning', async () => {
      helper.getComments.mockRejectedValueOnce(new Error());
      await initFakeRepo();
      const res = await gitea.ensureComment({
        number: 1,
        topic: 'some-topic',
        content: 'some-content',
      });

      expect(res).toEqual(false);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureCommentRemoval', () => {
    it('should remove existing comment by topic', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      await initFakeRepo();
      await gitea.ensureCommentRemoval({ number: 1, topic: 'some-topic' });

      expect(helper.deleteComment).toHaveBeenCalledTimes(1);
      expect(helper.deleteComment).toHaveBeenCalledWith(mockRepo.full_name, 3);
    });

    it('should remove existing comment by content', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      await initFakeRepo();
      await gitea.ensureCommentRemoval({ number: 1, content: 'some-body' });

      expect(helper.deleteComment).toHaveBeenCalledTimes(1);
      expect(helper.deleteComment).toHaveBeenCalledWith(mockRepo.full_name, 1);
    });

    it('should gracefully fail with warning', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      helper.deleteComment.mockRejectedValueOnce(new Error());
      await initFakeRepo();
      await gitea.ensureCommentRemoval({ number: 1, topic: 'some-topic' });

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should abort silently if comment is missing', async () => {
      helper.getComments.mockResolvedValueOnce(mockComments);
      await initFakeRepo();
      await gitea.ensureCommentRemoval({ number: 1, topic: 'missing' });

      expect(helper.deleteComment).not.toHaveBeenCalled();
    });
  });

  describe('getBranchPr', () => {
    it('should return existing pull request for branch', async () => {
      const mockPR = mockPRs[0];
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      expect(await gitea.getBranchPr(mockPR.head.label)).toHaveProperty(
        'number',
        mockPR.number
      );
    });

    it('should return null if no pull request exists', async () => {
      helper.searchPRs.mockResolvedValueOnce(mockPRs);
      await initFakeRepo();

      expect(await gitea.getBranchPr('missing')).toBeNull();
    });
  });

  describe('addAssignees', () => {
    it('should add assignees to the issue', async () => {
      await initFakeRepo();
      await gitea.addAssignees(1, ['me', 'you']);

      expect(helper.updateIssue).toHaveBeenCalledTimes(1);
      expect(helper.updateIssue).toHaveBeenCalledWith(mockRepo.full_name, 1, {
        assignees: ['me', 'you'],
      });
    });
  });

  describe('addReviewers', () => {
    it('should assign reviewers', async () => {
      expect.assertions(3);
      await initFakePlatform();
      const mockPR = mockPRs[0];
      await expect(
        gitea.addReviewers(mockPR.number, ['me', 'you'])
      ).resolves.not.toThrow();

      expect(helper.requestPrReviewers).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
    it('should should do nothing if version to old', async () => {
      expect.assertions(3);
      const mockPR = mockPRs[0];
      await expect(
        gitea.addReviewers(mockPR.number, ['me', 'you'])
      ).resolves.not.toThrow();

      expect(helper.requestPrReviewers).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
    it('catches errors', async () => {
      expect.assertions(2);
      const mockPR = mockPRs[0];
      await initFakePlatform();
      helper.requestPrReviewers.mockRejectedValueOnce(null);
      await expect(
        gitea.addReviewers(mockPR.number, ['me', 'you'])
      ).resolves.not.toThrow();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('massageMarkdown', () => {
    it('should truncate body to 1000000 characters', () => {
      const excessiveBody = '*'.repeat(1000001);

      expect(gitea.massageMarkdown(excessiveBody)).toHaveLength(1000000);
    });
  });

  describe('getVulnerabilityAlerts', () => {
    it('should return an empty list - unsupported by platform', async () => {
      expect(await gitea.getVulnerabilityAlerts()).toEqual([]);
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      helper.getRepoContents.mockResolvedValueOnce({
        contentString: JSON.stringify(data),
      } as never);
      await initFakeRepo({ full_name: 'some/repo' });
      const res = await gitea.getJsonFile('file.json');
      expect(res).toEqual(data);
    });
    it('throws on malformed JSON', async () => {
      helper.getRepoContents.mockResolvedValueOnce({
        contentString: '!@#',
      } as never);
      await initFakeRepo({ full_name: 'some/repo' });
      await expect(gitea.getJsonFile('file.json')).rejects.toThrow();
    });
    it('throws on errors', async () => {
      helper.getRepoContents.mockRejectedValueOnce(new Error('some error'));
      await initFakeRepo({ full_name: 'some/repo' });
      await expect(gitea.getJsonFile('file.json')).rejects.toThrow();
    });
  });
});
