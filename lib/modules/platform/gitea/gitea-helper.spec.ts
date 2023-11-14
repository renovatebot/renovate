import * as httpMock from '../../../../test/http-mock';
import { setBaseUrl } from '../../../util/http/gitea';
import { toBase64 } from '../../../util/string';
import {
  closeIssue,
  closePR,
  createComment,
  createCommitStatus,
  createIssue,
  createPR,
  deleteComment,
  getBranch,
  getCombinedCommitStatus,
  getComments,
  getCurrentUser,
  getIssue,
  getOrgLabels,
  getPR,
  getRepo,
  getRepoContents,
  getRepoLabels,
  getVersion,
  mergePR,
  requestPrReviewers,
  searchIssues,
  searchPRs,
  searchRepos,
  unassignLabel,
  updateComment,
  updateIssue,
  updateIssueLabels,
  updatePR,
} from './gitea-helper';
import type {
  Branch,
  Comment,
  Commit,
  CommitStatus,
  CommitStatusType,
  Issue,
  Label,
  PR,
  Repo,
  RepoContents,
  User,
} from './types';

describe('modules/platform/gitea/gitea-helper', () => {
  const giteaApiHost = 'https://gitea.renovatebot.com/';
  const baseUrl = `${giteaApiHost}api/v1`;

  const mockCommitHash = '0d9c7726c3d628b7e28af234595cfd20febdbf8e';

  const mockUser: User = {
    id: 1,
    username: 'admin',
    full_name: 'The Administrator',
    email: 'admin@example.com',
  };

  const otherMockUser: User & Required<Pick<User, 'full_name'>> = {
    ...mockUser,
    username: 'renovate',
    full_name: 'Renovate Bot',
    email: 'renovate@example.com',
  };

  const mockRepo: Repo = {
    id: 123,
    allow_rebase: true,
    allow_rebase_explicit: true,
    allow_merge_commits: true,
    allow_squash_merge: true,
    clone_url: 'https://gitea.renovatebot.com/some/repo.git',
    ssh_url: 'git@gitea.renovatebot.com/some/repo.git',
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

  const otherMockRepo: Repo = {
    ...mockRepo,
    full_name: 'other/repo',
    clone_url: 'https://gitea.renovatebot.com/other/repo.git',
  };

  const mockLabel: Label = {
    id: 100,
    name: 'some-label',
    description: 'just a label',
    color: '#000000',
  };

  const otherMockLabel: Label = {
    ...mockLabel,
    id: 200,
    name: 'other-label',
  };

  const mockPR: PR = {
    number: 13,
    state: 'open',
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

  const mockIssue: Issue = {
    number: 7,
    state: 'open',
    title: 'Some Issue',
    body: 'just some issue',
    assignees: [mockUser],
    labels: [],
  };

  const mockComment: Comment = {
    id: 31,
    body: 'some-comment',
  };

  const mockCommitStatus: CommitStatus = {
    id: 121,
    status: 'success',
    context: 'some-context',
    description: 'some-description',
    target_url: 'https://gitea.renovatebot.com/commit-status',
    created_at: '2020-03-25T00:00:00Z',
  };

  const otherMockCommitStatus: CommitStatus = {
    ...mockCommitStatus,
    id: 242,
    status: 'error',
    context: 'other-context',
  };

  const mockCommit: Commit = {
    id: mockCommitHash,
    author: {
      name: otherMockUser.full_name,
      email: otherMockUser.email,
      username: otherMockUser.username,
    },
  };

  const mockBranch: Branch = {
    name: 'some-branch',
    commit: mockCommit,
  };

  const otherMockBranch: Branch = {
    ...mockBranch,
    name: 'other/branch/with/slashes',
  };

  const mockContents: RepoContents = {
    path: 'dummy.txt',
    content: toBase64('top secret'),
    contentString: 'top secret',
  };

  const otherMockContents: RepoContents = {
    ...mockContents,
    path: 'nested/path/dummy.txt',
  };

  beforeEach(() => {
    setBaseUrl(giteaApiHost);
  });

  describe('getCurrentUser', () => {
    it('should call /api/v1/user endpoint', async () => {
      httpMock.scope(baseUrl).get('/user').reply(200, mockUser);

      const res = await getCurrentUser();
      expect(res).toEqual(mockUser);
    });
  });

  describe('getVersion', () => {
    it('should call /api/v1/version endpoint', async () => {
      const version = '1.13.01.14.0+dev-754-g5d2b7ba63';
      httpMock.scope(baseUrl).get('/version').reply(200, { version });

      const res = await getVersion();

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

      const res = await searchRepos({});
      expect(res).toEqual([mockRepo, otherMockRepo]);
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get('/repos/search?uid=13&archived=false')
        .reply(200, {
          ok: true,
          data: [otherMockRepo],
        });

      const res = await searchRepos({
        uid: 13,
        archived: false,
      });
      expect(res).toEqual([otherMockRepo]);
    });

    it('should abort if ok flag was not set', async () => {
      httpMock.scope(baseUrl).get('/repos/search').reply(200, {
        ok: false,
        data: [],
      });

      await expect(searchRepos({})).rejects.toThrow();
    });
  });

  describe('getRepo', () => {
    it('should call /api/v1/repos/[repo] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}`)
        .reply(200, mockRepo);

      const res = await getRepo(mockRepo.full_name);
      expect(res).toEqual(mockRepo);
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

      const res = await getRepoContents(mockRepo.full_name, mockContents.path);
      expect(res).toEqual(mockContents);
    });

    it('should support passing reference by query', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          `/repos/${mockRepo.full_name}/contents/${mockContents.path}?ref=${mockCommitHash}`,
        )
        .reply(200, { ...mockContents, contentString: undefined });

      const res = await getRepoContents(
        mockRepo.full_name,
        mockContents.path,
        mockCommitHash,
      );
      expect(res).toEqual(mockContents);
    });

    it('should properly escape paths', async () => {
      const escapedPath = encodeURIComponent(otherMockContents.path);

      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/contents/${escapedPath}`)
        .reply(200, otherMockContents);

      const res = await getRepoContents(
        mockRepo.full_name,
        otherMockContents.path,
      );
      expect(res).toEqual(otherMockContents);
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

      const res = await getRepoContents(mockRepo.full_name, mockContents.path);
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

      const res = await createPR(mockRepo.full_name, {
        state: mockPR.state,
        title: mockPR.title,
        body: mockPR.body,
        base: mockPR.base?.ref,
        head: mockPR.head?.label,
        assignees: [mockUser.username],
        labels: [mockLabel.id],
      });
      expect(res).toEqual(mockPR);
    });
  });

  describe('updatePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      const updatedMockPR: PR = {
        ...mockPR,
        state: 'closed',
        title: 'new-title',
        body: 'new-body',
      };

      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200, updatedMockPR);

      const res = await updatePR(mockRepo.full_name, mockPR.number, {
        state: 'closed',
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
      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200);

      const res = await closePR(mockRepo.full_name, mockPR.number);
      expect(res).toBeUndefined();
    });
  });

  describe('mergePR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull]/merge endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}/merge`)
        .reply(200);

      const res = await mergePR(mockRepo.full_name, mockPR.number, {
        Do: 'rebase',
      });
      expect(res).toBeUndefined();
    });
  });

  describe('getPR', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/pulls/${mockPR.number}`)
        .reply(200, mockPR);

      const res = await getPR(mockRepo.full_name, mockPR.number);
      expect(res).toEqual(mockPR);
    });
  });

  describe('addReviewers', () => {
    it('should call /api/v1/repos/[repo]/pulls/[pull]/requested_reviewers endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          `/repos/${mockRepo.full_name}/pulls/${mockPR.number}/requested_reviewers`,
        )
        .reply(200);

      await expect(
        requestPrReviewers(mockRepo.full_name, mockPR.number, {}),
      ).toResolve();
    });
  });

  describe('searchPRs', () => {
    it('should call /api/v1/repos/[repo]/pulls endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/pulls`)
        .reply(200, [mockPR]);

      const res = await searchPRs(mockRepo.full_name, {});
      expect(res).toEqual([mockPR]);
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get(
          `/repos/${mockRepo.full_name}/pulls?state=open&labels=${mockLabel.id}&labels=${otherMockLabel.id}`,
        )
        .reply(200, [mockPR]);

      const res = await searchPRs(mockRepo.full_name, {
        state: 'open',
        labels: [mockLabel.id, otherMockLabel.id],
      });
      expect(res).toEqual([mockPR]);
    });
  });

  describe('createIssue', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/issues`)
        .reply(200, mockIssue);

      const res = await createIssue(mockRepo.full_name, {
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
      const updatedMockIssue: Issue = {
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

      const res = await updateIssue(mockRepo.full_name, mockIssue.number, {
        state: 'closed',
        title: 'new-title',
        body: 'new-body',
        assignees: [otherMockUser.username],
      });
      expect(res).toEqual(updatedMockIssue);
    });
  });

  describe('updateIssueLabels', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/labels endpoint', async () => {
      const updatedMockLabels: Partial<Label>[] = [
        { id: 1, name: 'Renovate' },
        { id: 3, name: 'Maintenance' },
      ];

      httpMock
        .scope(baseUrl)
        .put(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}/labels`)
        .reply(200, updatedMockLabels);

      const res = await updateIssueLabels(
        mockRepo.full_name,
        mockIssue.number,
        {
          labels: [1, 3],
        },
      );
      expect(res).toEqual(updatedMockLabels);
    });
  });

  describe('closeIssue', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}`)
        .reply(200);

      const res = await closeIssue(mockRepo.full_name, mockIssue.number);
      expect(res).toBeUndefined();
    });
  });

  describe('searchIssues', () => {
    it('should call /api/v1/repos/[repo]/issues endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues?type=issues`)
        .reply(200, [mockIssue]);

      const res = await searchIssues(mockRepo.full_name, {});
      expect(res).toEqual([mockIssue]);
    });

    it('should construct proper query parameters', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues?state=open&type=issues`)
        .reply(200, [mockIssue]);

      const res = await searchIssues(mockRepo.full_name, {
        state: 'open',
      });
      expect(res).toEqual([mockIssue]);
    });
  });

  describe('getIssue', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}`)
        .reply(200, mockIssue);

      const res = await getIssue(mockRepo.full_name, mockIssue.number);
      expect(res).toEqual(mockIssue);
    });
  });

  describe('getRepoLabels', () => {
    it('should call /api/v1/repos/[repo]/labels endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/labels`)
        .reply(200, [mockLabel, otherMockLabel]);

      const res = await getRepoLabels(mockRepo.full_name);
      expect(res).toEqual([mockLabel, otherMockLabel]);
    });
  });

  describe('getOrgLabels', () => {
    it('should call /api/v1/orgs/[org]/labels endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/orgs/${mockRepo.owner.username}/labels`)
        .reply(200, [mockLabel, otherMockLabel]);

      const res = await getOrgLabels(mockRepo.owner.username);
      expect(res).toEqual([mockLabel, otherMockLabel]);
    });
  });

  describe('unassignLabel', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/labels/[label] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .delete(
          `/repos/${mockRepo.full_name}/issues/${mockIssue.number}/labels/${mockLabel.id}`,
        )
        .reply(200);

      const res = await unassignLabel(
        mockRepo.full_name,
        mockIssue.number,
        mockLabel.id,
      );
      expect(res).toBeUndefined();
    });
  });

  describe('createComment', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          `/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`,
        )
        .reply(200, mockComment);

      const res = await createComment(
        mockRepo.full_name,
        mockIssue.number,
        mockComment.body,
      );
      expect(res).toEqual(mockComment);
    });
  });

  describe('updateComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      const updatedMockComment: Comment = {
        ...mockComment,
        body: 'new-body',
      };

      httpMock
        .scope(baseUrl)
        .patch(`/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`)
        .reply(200, updatedMockComment);

      const res = await updateComment(
        mockRepo.full_name,
        mockComment.id,
        'new-body',
      );
      expect(res).toEqual(updatedMockComment);
    });
  });

  describe('deleteComment', () => {
    it('should call /api/v1/repos/[repo]/issues/comments/[comment] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .delete(
          `/repos/${mockRepo.full_name}/issues/comments/${mockComment.id}`,
        )
        .reply(200);

      const res = await deleteComment(mockRepo.full_name, mockComment.id);
      expect(res).toBeUndefined();
    });
  });

  describe('getComments', () => {
    it('should call /api/v1/repos/[repo]/issues/[issue]/comments endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/issues/${mockIssue.number}/comments`)
        .reply(200, [mockComment]);

      const res = await getComments(mockRepo.full_name, mockIssue.number);
      expect(res).toEqual([mockComment]);
    });
  });

  describe('createCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/statuses/[commit] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .post(`/repos/${mockRepo.full_name}/statuses/${mockCommitHash}`)
        .reply(200, mockCommitStatus);

      const res = await createCommitStatus(mockRepo.full_name, mockCommitHash, {
        state: mockCommitStatus.status,
        context: mockCommitStatus.context,
        description: mockCommitStatus.description,
        target_url: mockCommitStatus.target_url,
      });
      expect(res).toEqual(mockCommitStatus);
    });
  });

  describe('getCombinedCommitStatus', () => {
    it('should call /api/v1/repos/[repo]/commits/[branch]/statuses endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`)
        .reply(200, [mockCommitStatus, otherMockCommitStatus]);

      const res = await getCombinedCommitStatus(
        mockRepo.full_name,
        mockBranch.name,
      );
      expect(res.worstStatus).not.toBe('unknown');
      expect(res.statuses).toEqual([mockCommitStatus, otherMockCommitStatus]);
    });

    it('should properly determine worst commit status', async () => {
      const statuses: {
        status: CommitStatusType;
        created_at: string;
        expected: CommitStatusType;
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

      const commitStatuses: CommitStatus[] = [
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
            `/repos/${mockRepo.full_name}/commits/${mockBranch.name}/statuses`,
          )
          .reply(200, commitStatuses);

        // Expect to get the current state back as the worst status, as all previous commit statuses
        // should be less important than the one which just got added
        const res = await getCombinedCommitStatus(
          mockRepo.full_name,
          mockBranch.name,
        );
        expect(res.worstStatus).toEqual(expected);
      }
    });
  });

  describe('getBranch', () => {
    it('should call /api/v1/repos/[repo]/branches/[branch] endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/branches/${mockBranch.name}`)
        .reply(200, mockBranch);

      const res = await getBranch(mockRepo.full_name, mockBranch.name);
      expect(res).toEqual(mockBranch);
    });

    it('should properly escape branch names', async () => {
      const escapedBranchName = encodeURIComponent(otherMockBranch.name);

      httpMock
        .scope(baseUrl)
        .get(`/repos/${mockRepo.full_name}/branches/${escapedBranchName}`)
        .reply(200, otherMockBranch);

      const res = await getBranch(mockRepo.full_name, otherMockBranch.name);
      expect(res).toEqual(otherMockBranch);
    });
  });
});
