import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { PrState } from '../../types';
import { setBaseUrl } from '../../util/http/gitea';
import * as ght from './gitea-helper';

describe(getName(__filename), () => {
  const baseUrl = 'https://gitea.renovatebot.com/api/v1';

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
    state: PrState.Open,
    title: 'Some PR',
    body: 'Lorem ipsum dolor sit amet',
    mergeable: true,
    diff_url: `https://gitea.renovatebot.com/${mockRepo.full_name}/pulls/13.diff`,
    base: { ref: mockRepo.default_branch },
    head: {
      label: 'pull-req-13',
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
    created_at: '2020-03-25T00:00:00Z',
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

  beforeEach(() => {
    jest.resetAllMocks();
    httpMock.reset();
    httpMock.setup();
    setBaseUrl(baseUrl);
  });
  afterEach(() => {
    httpMock.reset();
  });

  describe('getCurrentUser', () => {
    it('should call /api/v1/user endpoint', async () => {
      httpMock.scope(baseUrl).get('/user').reply(200, mockUser);

      const res = await ght.getCurrentUser();
      expect(res).toEqual(mockUser);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getVersion', () => {
    it('should call /api/v1/version endpoint', async () => {
      const version = '1.13.01.14.0+dev-754-g5d2b7ba63';
      httpMock.scope(baseUrl).get('/version').reply(200, { version });

      const res = await ght.getVersion();
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).toEqual(version);
    });
  });

  describe('searchRepos', () => {
    it('should call /api/v1/repos/search endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get('/repos/search')
        .reply(200, {
          ok: true,
          data: [mockRepo, otherMockRepo],
        });

      const res = await ght.searchRepos({});
      expect(res).toEqual([mockRepo, otherMockRepo]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get('/repos/search?uid=13&archived=false')
        .reply(200, {
          ok: true,
          data: [otherMockRepo],
        });

      const res = await ght.searchRepos({
        uid: 13,
        archived: false,
      });
      expect(res).toEqual([otherMockRepo]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should abort if ok flag was not set', async () => {
      httpMock.scope(baseUrl).get('/repos/search').reply(200, {
        ok: false,
        data: [],
      });

      await expect(ght.searchRepos({})).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepo', () => {
    it('should call /api/v1/repos/[repo] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}`)
        .reply(200, mockRepo);

      const res = await ght.getRepo(mockRepo.full_name);
      expect(res).toEqual(mockRepo);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepoContents', () => {
    it('should call /api/v1/repos/[repo]/contents/[file] endpoint', async () => {
      // The official API only returns the base64-encoded content, so we strip `contentString`
      // from our mock to verify base64 decoding.
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/contents/${mockContents.path}`)
        .reply(200, { ...mockContents, contentString: undefined });

      const res = await ght.getRepoContents(
        mockRepo.full_name,
        mockContents.path
      );
      expect(res).toEqual(mockContents);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should support passing reference by query', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          `/repos/${mockRepo.full_name}/contents/${mockContents.path}?ref=${mockCommitHash}`
        )
        .reply(200, { ...mockContents, contentString: undefined });

      const res = await ght.getRepoContents(
        mockRepo.full_name,
        mockContents.path,
        mockCommitHash
      );
      expect(res).toEqual(mockContents);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should properly escape paths', async () => {
      const escapedPath = encodeURIComponent(otherMockContents.path);

      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/contents/${escapedPath}`)
        .reply(200, otherMockContents);

      const res = await ght.getRepoContents(
        mockRepo.full_name,
        otherMockContents.path
      );
      expect(res).toEqual(otherMockContents);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should not fail if no content is returned', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/contents/${mockContents.path}`)
        .reply(200, {
          ...mockContents,
          content: undefined,
          contentString: undefined,
        });

      const res = await ght.getRepoContents(
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
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/pulls`)
        .reply(200, mockPR);

      const res = await ght.createPR(mockRepo.full_name, {
        state: mockPR.state,
        title: mockPR.title,
        body: mockPR.body,
        base: mockPR.base.ref,
        head: mockPR.head.label,
        assignees: [mockUser.username],
        labels: [mockLabel.id],
      });
      expect(res).toEqual(mockPR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('updatePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      const updatedMockPR: ght.PR = {
        ...mockPR,
        state: PrState.Closed,
        title: 'new-title',
        body: 'new-body',
      };

      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200, updatedMockPR);

      const res = await ght.updatePR(mockRepo.full_name, mockPR.number, {
        state: PrState.Closed,
        title: 'new-title',
        body: 'new-body',
        assignees: [otherMockUser.username],
        labels: [otherMockLabel.id],
      });
      expect(res).toEqual(updatedMockPR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('closePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200);

      const res = await ght.closePR(mockRepo.full_name, mockPR.number);
      expect(res).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('mergePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull]/merge endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}/merge`)
        .reply(200);

      const res = await ght.mergePR(
        mockRepo.full_name,
        mockPR.number,
        'rebase'
      );
      expect(res).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200, mockPR);

      const res = await ght.getPR(mockRepo.full_name, mockPR.number);
      expect(res).toEqual(mockPR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('addReviewers', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull]/requested_reviewers endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          `/repos/${mockRepo.full_name}/pulls/${mockPR.number}/requested_reviewers`
        )
        .reply(200);

      await ght.requestPrReviewers(mockRepo.full_name, mockPR.number, {});
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('searchPRs', () => {
    it('should call /api/v1/repos/[repo]/pulls endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/pulls`)
        .reply(200, [mockPR]);

      const res = await ght.searchPRs(mockRepo.full_name, {});
      expect(res).toEqual([mockPR]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          `/repos/${mockRepo.full_name}/pulls?state=open&labels=${mockLabel.id}&labels=${otherMockLabel.id}`
        )
        .reply(200, [mockPR]);

      const res = await ght.searchPRs(mockRepo.full_name, {
        state: PrState.Open,
        labels: [mockLabel.id, otherMockLabel.id],
      });
      expect(res).toEqual([mockPR]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('createIssue', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/issues`)
        .reply(200, mockIssue);

      const res = await ght.createIssue(mockRepo.full_name, {
        state: mockIssue.state,
        title: mockIssue.title,
        body: mockIssue.body,
        assignees: [mockUser.username],
      });
      expect(res).toEqual(mockIssue);
      expect(httpMock.getTrace()).toMatchSnapshot();
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

      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}`)
        .reply(200, updatedMockIssue);

      const res = await ght.updateIssue(mockRepo.full_name, mockIssue.number, {
        state: 'closed',
        title: 'new-title',
        body: 'new-body',
        assignees: [otherMockUser.username],
      });
      expect(res).toEqual(updatedMockIssue);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('closeIssue', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}`)
        .reply(200);

      const res = await ght.closeIssue(mockRepo.full_name, mockIssue.number);
      expect(res).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('searchIssues', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues?type=issues`)
        .reply(200, [mockIssue]);

      const res = await ght.searchIssues(mockRepo.full_name, {});
      expect(res).toEqual([mockIssue]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues?state=open&type=issues`)
        .reply(200, [mockIssue]);

      const res = await ght.searchIssues(mockRepo.full_name, {
        state: 'open',
      });
      expect(res).toEqual([mockIssue]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getRepoLabels', () => {
    it('should call /api/v1/repos/[repo]/labels endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/labels`)
        .reply(200, [mockLabel, otherMockLabel]);

      const res = await ght.getRepoLabels(mockRepo.full_name);
      expect(res).toEqual([mockLabel, otherMockLabel]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getOrgLabels', () => {
    it('should call /api/v1/orgs/[org]/labels endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/orgs/${mockRepo.owner.username}/labels`)
        .reply(200, [mockLabel, otherMockLabel]);

      const res = await ght.getOrgLabels(mockRepo.owner.username);
      expect(res).toEqual([mockLabel, otherMockLabel]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('unassignLabel', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/labels/[label] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .delete(
          `/repos/${mockRepo.full_name}/issues/${mockIssue.number}/labels/${mockLabel.id}`
        )
        .reply(200);

      const res = await ght.unassignLabel(
        mockRepo.full_name,
        mockIssue.number,
        mockLabel.id
      );
      expect(res).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('createComment', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          `/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`
        )
        .reply(200, mockComment);

      const res = await ght.createComment(
        mockRepo.full_name,
        mockIssue.number,
        mockComment.body
      );
      expect(res).toEqual(mockComment);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('updateComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      const updatedMockComment: ght.Comment = {
        ...mockComment,
        body: 'new-body',
      };

      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`)
        .reply(200, updatedMockComment);

      const res = await ght.updateComment(
        mockRepo.full_name,
        mockComment.id,
        'new-body'
      );
      expect(res).toEqual(updatedMockComment);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('deleteComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .delete(
          `/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`
        )
        .reply(200);

      const res = await ght.deleteComment(mockRepo.full_name, mockComment.id);
      expect(res).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getComments', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`)
        .reply(200, [mockComment]);

      const res = await ght.getComments(mockRepo.full_name, mockIssue.number);
      expect(res).toEqual([mockComment]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('createCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/statuses/[commit] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/statuses/${mockCommitHash}`)
        .reply(200, mockCommitStatus);

      const res = await ght.createCommitStatus(
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getCombinedCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/commits/[branch]/statuses endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`)
        .reply(200, [mockCommitStatus, otherMockCommitStatus]);

      const res = await ght.getCombinedCommitStatus(
        mockRepo.full_name,
        mockBranch.name
      );
      expect(res.worstStatus).not.toEqual('unknown');
      expect(res.statuses).toEqual([mockCommitStatus, otherMockCommitStatus]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should properly determine worst commit status', async () => {
      const statuses: {
        status: ght.CommitStatusType;
        created_at: string;
        expected: ght.CommitStatusType;
      }[] = [
        {
          status: 'unknown',
          created_at: '2020-03-25T01:00:00Z',
          expected: 'unknown',
        },
        {
          status: 'pending',
          created_at: '2020-03-25T03:00:00Z',
          expected: 'pending',
        },
        {
          status: 'warning',
          created_at: '2020-03-25T04:00:00Z',
          expected: 'warning',
        },
        {
          status: 'failure',
          created_at: '2020-03-25T05:00:00Z',
          expected: 'failure',
        },
        {
          status: 'success',
          created_at: '2020-03-25T02:00:00Z',
          expected: 'failure',
        },
        {
          status: 'success',
          created_at: '2020-03-25T06:00:00Z',
          expected: 'success',
        },
      ];

      const commitStatuses: ght.CommitStatus[] = [
        { ...mockCommitStatus, status: 'unknown' },
      ];

      for (const statusElem of statuses) {
        const { status, expected } = statusElem;
        // Add current status ot list of commit statuses, then mock the API to return the whole list
        commitStatuses.push({
          ...mockCommitStatus,
          status,
          created_at: statusElem.created_at,
        });
        httpMock
          .scope(baseUrl)
          .get(
            `/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`
          )
          .reply(200, commitStatuses);

        // Expect to get the current state back as the worst status, as all previous commit statuses
        // should be less important than the one which just got added
        const res = await ght.getCombinedCommitStatus(
          mockRepo.full_name,
          mockBranch.name
        );
        expect(res.worstStatus).toEqual(expected);
        expect(httpMock.getTrace()).toMatchSnapshot();
      }
    });
  });

  describe('getBranch', () => {
    it('should call /api/v1/repos/[repo]/branches/[branch] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/branches/${mockBranch.name}`)
        .reply(200, mockBranch);

      const res = await ght.getBranch(mockRepo.full_name, mockBranch.name);
      expect(res).toEqual(mockBranch);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should properly escape branch names', async () => {
      const escapedBranchName = encodeURIComponent(otherMockBranch.name);

      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/branches/${escapedBranchName}`)
        .reply(200, otherMockBranch);

      const res = await ght.getBranch(mockRepo.full_name, otherMockBranch.name);
      expect(res).toEqual(otherMockBranch);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
