import { URL } from 'url';
import { PR_STATE_CLOSED } from '../../constants/pull-requests';
import { GotResponse } from '..';
import { partial } from '../../../test/util';
import { GiteaGotApi, GiteaGotOptions } from './gitea-got-wrapper';
import * as ght from './gitea-helper';
import { PRSearchParams } from './gitea-helper';

describe('platform/gitea/gitea-helper', () => {
  let helper: typeof import('./gitea-helper');
  let api: jest.Mocked<GiteaGotApi>;

  const baseURL = 'https://gitea.renovatebot.com/api/v1';

  const mockCommitHash = '0d9c7726c3d628b7e28af234595cfd20febdbf8e';

  const mockUser: ght.User = {
    id: 1,
    username: 'admin',
    full_name: 'The Administrator',
    email: 'admin@example.com',
  };

  const otherMockUser: ght.User = {
    ...mockUser,
    username: 'renovate',
    full_name: 'Renovate Bot',
    email: 'renovate@example.com',
  };

  const mockRepo: ght.Repo = {
    allow_rebase: true,
    allow_rebase_explicit: true,
    allow_merge_commits: true,
    allow_squash_merge: true,
    clone_url: 'https://gitea.renovatebot.com/some/repo.git',
    default_branch: 'master',
    full_name: 'some/repo',
    archived: false,
    mirror: false,
    empty: false,
    fork: false,
    owner: mockUser,
    permissions: {
      pull: true,
      push: true,
      admin: false,
    },
  };

  const otherMockRepo: ght.Repo = {
    ...mockRepo,
    full_name: 'other/repo',
    clone_url: 'https://gitea.renovatebot.com/other/repo.git',
  };

  const mockLabel: ght.Label = {
    id: 100,
    name: 'some-label',
    description: 'just a label',
    color: '#000000',
  };

  const otherMockLabel: ght.Label = {
    ...mockLabel,
    id: 200,
    name: 'other-label',
  };

  const mockPR: ght.PR = {
    number: 13,
    state: 'open',
    title: 'Some PR',
    body: 'Lorem ipsum dolor sit amet',
    mergeable: true,
    diff_url: `https://gitea.renovatebot.com/${mockRepo.full_name}/pulls/13.diff`,
    base: { ref: mockRepo.default_branch },
    head: {
      ref: 'pull-req-13',
      sha: mockCommitHash,
      repo: mockRepo,
    },
    created_at: '2018-08-13T20:45:37Z',
    closed_at: '2020-04-01T19:19:22Z',
  };

  const mockIssue: ght.Issue = {
    number: 7,
    state: 'open',
    title: 'Some Issue',
    body: 'just some issue',
    assignees: [mockUser],
  };

  const mockComment: ght.Comment = {
    id: 31,
    body: 'some-comment',
  };

  const mockCommitStatus: ght.CommitStatus = {
    id: 121,
    status: 'success',
    context: 'some-context',
    description: 'some-description',
    target_url: 'https://gitea.renovatebot.com/commit-status',
  };

  const otherMockCommitStatus: ght.CommitStatus = {
    ...mockCommitStatus,
    id: 242,
    status: 'error',
    context: 'other-context',
  };

  const mockCommit: ght.Commit = {
    id: mockCommitHash,
    author: {
      name: otherMockUser.full_name,
      email: otherMockUser.email,
      username: otherMockUser.username,
    },
  };

  const mockBranch: ght.Branch = {
    name: 'some-branch',
    commit: mockCommit,
  };

  const otherMockBranch: ght.Branch = {
    ...mockBranch,
    name: 'other/branch/with/slashes',
  };

  const mockContents: ght.RepoContents = {
    path: 'dummy.txt',
    content: Buffer.from('top secret').toString('base64'),
    contentString: 'top secret',
  };

  const otherMockContents: ght.RepoContents = {
    ...mockContents,
    path: 'nested/path/dummy.txt',
  };

  const mockAPI = <B extends object = undefined, P extends object = {}>(
    userOptions: {
      method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
      urlPattern?: string | RegExp;
      queryParams?: Record<string, string[]>;
      postParams?: P;
    },
    body: B = undefined
  ) => {
    // Merge default options with user options
    const options = {
      method: 'get',
      ...userOptions,
    };

    // Mock request implementation once and verify request
    api[options.method].mockImplementationOnce(
      (rawUrl: string, apiOpts?: GiteaGotOptions): Promise<GotResponse<B>> => {
        // Construct and parse absolute URL
        const absoluteUrl = rawUrl.includes('://')
          ? rawUrl
          : `${baseURL}/${rawUrl}`;
        const url = new URL(absoluteUrl);

        // Check optional URL pattern matcher
        if (options.urlPattern !== undefined) {
          const regex =
            options.urlPattern instanceof RegExp
              ? options.urlPattern
              : new RegExp(`^${options.urlPattern}$`);

          if (!regex.exec(url.pathname)) {
            throw new Error(
              `expected url [${url.pathname}] to match pattern: ${options.urlPattern}`
            );
          }
        }

        // Check optional query params
        if (options.queryParams !== undefined) {
          for (const [key, expected] of Object.entries(options.queryParams)) {
            expect(url.searchParams.getAll(key)).toEqual(expected);
          }
        }

        // Check optional post parameters
        if (options.postParams !== undefined) {
          expect(apiOpts.body).toEqual(options.postParams);
        }

        return Promise.resolve(
          partial<GotResponse<B>>({ body })
        );
      }
    );
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mock('../../../lib/platform/gitea/gitea-got-wrapper');

    helper = (await import('./gitea-helper')) as any;
    api = (await import('./gitea-got-wrapper')).api as any;
  });

  describe('getCurrentUser', () => {
    it('should call /api/v1/user endpoint', async () => {
      mockAPI<ght.User>({ urlPattern: '/api/v1/user' }, mockUser);

      const res = await helper.getCurrentUser();
      expect(res).toEqual(mockUser);
    });
  });

  describe('searchRepos', () => {
    it('should call /api/v1/repos/search endpoint', async () => {
      mockAPI<ght.RepoSearchResults>(
        { urlPattern: '/api/v1/repos/search' },
        {
          ok: true,
          data: [mockRepo, otherMockRepo],
        }
      );

      const res = await helper.searchRepos({});
      expect(res).toEqual([mockRepo, otherMockRepo]);
    });

    it('should construct proper query parameters', async () => {
      mockAPI<ght.RepoSearchResults>(
        {
          urlPattern: '/api/v1/repos/search',
          queryParams: {
            uid: ['13'],
          },
        },
        {
          ok: true,
          data: [otherMockRepo],
        }
      );

      const res = await helper.searchRepos({
        uid: 13,
      });
      expect(res).toEqual([otherMockRepo]);
    });

    it('should abort if ok flag was not set', async () => {
      mockAPI<ght.RepoSearchResults>(
        { urlPattern: '/api/v1/repos/search' },
        {
          ok: false,
          data: [],
        }
      );

      await expect(helper.searchRepos({})).rejects.toThrow();
    });
  });

  describe('getRepo', () => {
    it('should call /api/v1/repos/[repo] endpoint', async () => {
      mockAPI<ght.Repo>(
        { urlPattern: `/api/v1/repos/${mockRepo.full_name}` },
        mockRepo
      );

      const res = await helper.getRepo(mockRepo.full_name);
      expect(res).toEqual(mockRepo);
    });
  });

  describe('getRepoContents', () => {
    it('should call /api/v1/repos/[repo]/contents/[file] endpoint', async () => {
      // The official API only returns the base64-encoded content, so we strip `contentString`
      // from our mock to verify base64 decoding.
      mockAPI<ght.RepoContents>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/contents/${mockContents.path}`,
        },
        { ...mockContents, contentString: undefined }
      );

      const res = await helper.getRepoContents(
        mockRepo.full_name,
        mockContents.path
      );
      expect(res).toEqual(mockContents);
    });

    it('should support passing reference by query', async () => {
      mockAPI<ght.RepoContents>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/contents/${mockContents.path}`,
          queryParams: {
            ref: [mockCommitHash],
          },
        },
        { ...mockContents, contentString: undefined }
      );

      const res = await helper.getRepoContents(
        mockRepo.full_name,
        mockContents.path,
        mockCommitHash
      );
      expect(res).toEqual(mockContents);
    });

    it('should properly escape paths', async () => {
      const escapedPath = encodeURIComponent(otherMockContents.path);

      mockAPI<ght.RepoContents>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/contents/${escapedPath}`,
        },
        otherMockContents
      );

      const res = await helper.getRepoContents(
        mockRepo.full_name,
        otherMockContents.path
      );
      expect(res).toEqual(otherMockContents);
    });

    it('should not fail if no content is returned', async () => {
      mockAPI<ght.RepoContents>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/contents/${mockContents.path}`,
        },
        { ...mockContents, content: undefined, contentString: undefined }
      );

      const res = await helper.getRepoContents(
        mockRepo.full_name,
        mockContents.path
      );
      expect(res).toEqual({
        ...mockContents,
        content: undefined,
        contentString: undefined,
      });
    });
  });

  describe('createPR', () => {
    it('should call /api/v1/repos/[repo]/pulls endpoint', async () => {
      mockAPI<ght.PR, Required<ght.PRCreateParams>>(
        {
          method: 'post',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls`,
          postParams: {
            state: mockPR.state,
            title: mockPR.title,
            body: mockPR.body,
            base: mockPR.base.ref,
            head: mockPR.head.ref,
            assignees: [mockUser.username],
            labels: [mockLabel.id],
          },
        },
        mockPR
      );

      const res = await helper.createPR(mockRepo.full_name, {
        state: mockPR.state,
        title: mockPR.title,
        body: mockPR.body,
        base: mockPR.base.ref,
        head: mockPR.head.ref,
        assignees: [mockUser.username],
        labels: [mockLabel.id],
      });
      expect(res).toEqual(mockPR);
    });
  });

  describe('updatePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      const updatedMockPR: ght.PR = {
        ...mockPR,
        state: 'closed',
        title: 'new-title',
        body: 'new-body',
      };

      mockAPI<ght.PR, Required<ght.PRUpdateParams>>(
        {
          method: 'patch',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls/${mockPR.number}`,
          postParams: {
            state: 'closed',
            title: 'new-title',
            body: 'new-body',
            assignees: [otherMockUser.username],
            labels: [otherMockLabel.id],
          },
        },
        updatedMockPR
      );

      const res = await helper.updatePR(mockRepo.full_name, mockPR.number, {
        state: PR_STATE_CLOSED,
        title: 'new-title',
        body: 'new-body',
        assignees: [otherMockUser.username],
        labels: [otherMockLabel.id],
      });
      expect(res).toEqual(updatedMockPR);
    });
  });

  describe('closePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      mockAPI<undefined, ght.PRUpdateParams>({
        method: 'patch',
        urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls/${mockPR.number}`,
        postParams: {
          state: 'closed',
        },
      });

      const res = await helper.closePR(mockRepo.full_name, mockPR.number);
      expect(res).toBeUndefined();
    });
  });

  describe('mergePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull]/merge endpoint', async () => {
      mockAPI<undefined, ght.PRMergeParams>({
        method: 'patch',
        urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls/${mockPR.number}/merge`,
        postParams: {
          Do: 'rebase',
        },
      });

      const res = await helper.mergePR(
        mockRepo.full_name,
        mockPR.number,
        'rebase'
      );
      expect(res).toBeUndefined();
    });
  });

  describe('getPR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      mockAPI<ght.PR>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls/${mockPR.number}`,
        },
        mockPR
      );

      const res = await helper.getPR(mockRepo.full_name, mockPR.number);
      expect(res).toEqual(mockPR);
    });
  });

  describe('searchPRs', () => {
    it('should call /api/v1/repos/[repo]/pulls endpoint', async () => {
      mockAPI<ght.PR[]>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls`,
        },
        [mockPR]
      );

      const res = await helper.searchPRs(mockRepo.full_name, {});
      expect(res).toEqual([mockPR]);
    });

    it('should construct proper query parameters', async () => {
      mockAPI<ght.PR[], Required<PRSearchParams>>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/pulls`,
          queryParams: {
            state: ['open'],
            labels: [`${mockLabel.id}`, `${otherMockLabel.id}`],
          },
        },
        [mockPR]
      );

      const res = await helper.searchPRs(mockRepo.full_name, {
        state: 'open',
        labels: [mockLabel.id, otherMockLabel.id],
      });
      expect(res).toEqual([mockPR]);
    });
  });

  describe('createIssue', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      mockAPI<ght.Issue, Required<ght.IssueCreateParams>>(
        {
          method: 'post',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues`,
          postParams: {
            state: mockIssue.state,
            title: mockIssue.title,
            body: mockIssue.body,
            assignees: [mockUser.username],
          },
        },
        mockIssue
      );

      const res = await helper.createIssue(mockRepo.full_name, {
        state: mockIssue.state,
        title: mockIssue.title,
        body: mockIssue.body,
        assignees: [mockUser.username],
      });
      expect(res).toEqual(mockIssue);
    });
  });

  describe('updateIssue', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue] endpoint', async () => {
      const updatedMockIssue: ght.Issue = {
        ...mockIssue,
        state: 'closed',
        title: 'new-title',
        body: 'new-body',
        assignees: [otherMockUser],
      };

      mockAPI<ght.Issue, Required<ght.IssueUpdateParams>>(
        {
          method: 'patch',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/${mockIssue.number}`,
          postParams: {
            state: 'closed',
            title: 'new-title',
            body: 'new-body',
            assignees: [otherMockUser.username],
          },
        },
        updatedMockIssue
      );

      const res = await helper.updateIssue(
        mockRepo.full_name,
        mockIssue.number,
        {
          state: 'closed',
          title: 'new-title',
          body: 'new-body',
          assignees: [otherMockUser.username],
        }
      );
      expect(res).toEqual(updatedMockIssue);
    });
  });

  describe('closeIssue', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue] endpoint', async () => {
      mockAPI<ght.IssueUpdateParams>({
        method: 'patch',
        urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/${mockIssue.number}`,
        postParams: {
          state: 'closed',
        },
      });

      const res = await helper.closeIssue(mockRepo.full_name, mockIssue.number);
      expect(res).toBeUndefined();
    });
  });

  describe('searchIssues', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      mockAPI<ght.Issue[]>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues`,
        },
        [mockIssue]
      );

      const res = await helper.searchIssues(mockRepo.full_name, {});
      expect(res).toEqual([mockIssue]);
    });

    it('should construct proper query parameters', async () => {
      mockAPI<ght.Issue[], Required<PRSearchParams>>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues`,
          queryParams: {
            state: ['open'],
          },
        },
        [mockIssue]
      );

      const res = await helper.searchIssues(mockRepo.full_name, {
        state: 'open',
      });
      expect(res).toEqual([mockIssue]);
    });
  });

  describe('getRepoLabels', () => {
    it('should call /api/v1/repos/[repo]/labels endpoint', async () => {
      mockAPI<ght.Label[]>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/labels`,
        },
        [mockLabel, otherMockLabel]
      );

      const res = await helper.getRepoLabels(mockRepo.full_name);
      expect(res).toEqual([mockLabel, otherMockLabel]);
    });
  });

  describe('unassignLabel', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/labels/[label] endpoint', async () => {
      mockAPI({
        method: 'delete',
        urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/${mockIssue.number}/labels/${mockLabel.id}`,
      });

      const res = await helper.unassignLabel(
        mockRepo.full_name,
        mockIssue.number,
        mockLabel.id
      );
      expect(res).toBeUndefined();
    });
  });

  describe('createComment', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      mockAPI<ght.Comment, Required<ght.CommentCreateParams>>(
        {
          method: 'post',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`,
          postParams: {
            body: mockComment.body,
          },
        },
        mockComment
      );

      const res = await helper.createComment(
        mockRepo.full_name,
        mockIssue.number,
        mockComment.body
      );
      expect(res).toEqual(mockComment);
    });
  });

  describe('updateComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      const updatedMockComment: ght.Comment = {
        ...mockComment,
        body: 'new-body',
      };

      mockAPI<ght.Comment, Required<ght.CommentUpdateParams>>(
        {
          method: 'patch',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`,
          postParams: {
            body: 'new-body',
          },
        },
        updatedMockComment
      );

      const res = await helper.updateComment(
        mockRepo.full_name,
        mockComment.id,
        'new-body'
      );
      expect(res).toEqual(updatedMockComment);
    });
  });

  describe('deleteComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      mockAPI({
        method: 'delete',
        urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`,
      });

      const res = await helper.deleteComment(
        mockRepo.full_name,
        mockComment.id
      );
      expect(res).toBeUndefined();
    });
  });

  describe('getComments', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      mockAPI<ght.Comment[]>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`,
        },
        [mockComment]
      );

      const res = await helper.getComments(
        mockRepo.full_name,
        mockIssue.number
      );
      expect(res).toEqual([mockComment]);
    });
  });

  describe('createCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/statuses/[commit] endpoint', async () => {
      mockAPI<ght.CommitStatus, Required<ght.CommitStatusCreateParams>>(
        {
          method: 'post',
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/statuses/${mockCommitHash}`,
          postParams: {
            state: mockCommitStatus.status,
            context: mockCommitStatus.context,
            description: mockCommitStatus.description,
            target_url: mockCommitStatus.target_url,
          },
        },
        mockCommitStatus
      );

      const res = await helper.createCommitStatus(
        mockRepo.full_name,
        mockCommitHash,
        {
          state: mockCommitStatus.status,
          context: mockCommitStatus.context,
          description: mockCommitStatus.description,
          target_url: mockCommitStatus.target_url,
        }
      );
      expect(res).toEqual(mockCommitStatus);
    });
  });

  describe('getCombinedCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/commits/[branch]/statuses endpoint', async () => {
      mockAPI<ght.CommitStatus[]>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`,
        },
        [mockCommitStatus, otherMockCommitStatus]
      );

      const res = await helper.getCombinedCommitStatus(
        mockRepo.full_name,
        mockBranch.name
      );
      expect(res.worstStatus).not.toEqual('unknown');
      expect(res.statuses).toEqual([mockCommitStatus, otherMockCommitStatus]);
    });

    it('should properly determine worst commit status', async () => {
      const statuses: ght.CommitStatusType[] = [
        'unknown',
        'success',
        'pending',
        'warning',
        'failure',
        'error',
      ];

      const commitStatuses: ght.CommitStatus[] = [
        { ...mockCommitStatus, status: 'unknown' },
      ];

      for (const status of statuses) {
        // Add current status ot list of commit statuses, then mock the API to return the whole list
        commitStatuses.push({ ...mockCommitStatus, status });
        mockAPI<ght.CommitStatus[]>(
          {
            urlPattern: `/api/v1/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`,
          },
          commitStatuses
        );

        // Expect to get the current state back as the worst status, as all previous commit statuses
        // should be less important than the one which just got added
        const res = await helper.getCombinedCommitStatus(
          mockRepo.full_name,
          mockBranch.name
        );
        expect(res.worstStatus).toEqual(status);
      }
    });
  });

  describe('getBranch', () => {
    it('should call /api/v1/repos/[repo]/branches/[branch] endpoint', async () => {
      mockAPI<ght.Branch>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/branches/${mockBranch.name}`,
        },
        mockBranch
      );

      const res = await helper.getBranch(mockRepo.full_name, mockBranch.name);
      expect(res).toEqual(mockBranch);
    });

    it('should properly escape branch names', async () => {
      const escapedBranchName = encodeURIComponent(otherMockBranch.name);

      mockAPI<ght.Branch>(
        {
          urlPattern: `/api/v1/repos/${mockRepo.full_name}/branches/${escapedBranchName}`,
        },
        otherMockBranch
      );

      const res = await helper.getBranch(
        mockRepo.full_name,
        otherMockBranch.name
      );
      expect(res).toEqual(otherMockBranch);
    });
  });
});
