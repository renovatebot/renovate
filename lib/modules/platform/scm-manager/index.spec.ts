import * as httpMock from '../../../../test/http-mock';
import { git, mocked } from '../../../../test/util';
import * as hostRules from '../../../util/host-rules';
import type { Pr } from '../types';
import * as _util from '../util';
import { mapPrFromScmToRenovate } from './mapper';
import type { PrFilterByState, PullRequest, Repo, User } from './types';
import {
  addAssignees,
  addReviewers,
  createPr,
  deleteLabel,
  ensureCommentRemoval,
  ensureIssue,
  ensureIssueClosing,
  findIssue,
  findPr,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  getIssueList,
  getJsonFile,
  getPr,
  getPrList,
  getRawFile,
  getRepoForceRebase,
  getRepos,
  initPlatform,
  initRepo,
  invalidatePrCache,
  massageMarkdown,
  maxBodyLength,
  mergePr,
  setBranchStatus,
  updatePr,
} from './index';

jest.mock('../../../util/git');
jest.mock('../util');
const util: jest.Mocked<typeof _util> = mocked(_util);

const endpoint = 'https://localhost:8080/scm/api/v2';
const token = 'TEST_TOKEN';

const user: User = {
  mail: 'test@user.de',
  displayName: 'Test User',
  name: 'testUser1337',
};

const repo: Repo = {
  contact: 'test@test.com',
  creationDate: '2023-08-02T10:48:24.762Z',
  description: 'Default Repo',
  lastModified: '2023-08-10T10:48:24.762Z',
  namespace: 'default',
  name: 'repo',
  type: 'git',
  archived: false,
  exporting: false,
  healthCheckRunning: false,
  _links: {
    protocol: [
      { name: 'http', href: 'https://localhost:8080/scm/default/repo' },
    ],
    defaultBranch: {
      href: 'https://localhost:8080/scm/api/v2/config/git/default/repo/default-branch',
    },
  },
};

const pullRequest: PullRequest = {
  id: '1',
  author: { displayName: 'Thomas Zerr', id: 'tzerr' },
  source: 'feature/test',
  target: 'develop',
  title: 'The PullRequest',
  description: 'Another PullRequest',
  creationDate: '2023-08-02T10:48:24.762Z',
  status: 'OPEN',
  labels: [],
  tasks: { todo: 2, done: 4 },
  _links: {},
  _embedded: {
    defaultConfig: {
      mergeStrategy: 'SQUASH',
      deleteBranchOnMerge: true,
    },
  },
};

const renovatePr: Pr = mapPrFromScmToRenovate(pullRequest);

describe('modules/platform/scm-manager/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    hostRules.add({ token, username: user.name });
    invalidatePrCache();
  });

  describe(initPlatform, () => {
    it('should throw error, when endpoint is not configured', async () => {
      await expect(initPlatform({ token })).rejects.toThrow(
        'SCM-Manager endpoint not configured',
      );
    });

    it('should throw error, when token is not configured', async () => {
      await expect(initPlatform({ endpoint })).rejects.toThrow(
        'SCM-Manager API token not configured',
      );
    });

    it('should throw error, when token is invalid', async () => {
      httpMock.scope(endpoint).get(`/me`).reply(401);

      await expect(
        initPlatform({ endpoint, token: 'invalid' }),
      ).rejects.toThrow('Init: Authentication failure');
    });

    it('should init platform', async () => {
      httpMock.scope(endpoint).get('/me').reply(200, user);
      expect(await initPlatform({ endpoint, token })).toEqual({
        endpoint,
        gitAuthor: 'Test User <test@user.de>',
      });
    });
  });

  describe(initRepo, () => {
    it('should init repo', async () => {
      const repository = `${repo.namespace}/${repo.name}`;
      const expectedFingerprint = 'expectedFingerprint';
      const expectedDefaultBranch = 'expectedDefaultBranch';

      httpMock
        .scope(endpoint)
        .get(`/repositories/${repository}`)
        .reply(200, repo);
      httpMock
        .scope(endpoint)
        .get(`/config/git/${repository}/default-branch`)
        .reply(200, { defaultBranch: expectedDefaultBranch });

      util.repoFingerprint.mockReturnValueOnce(expectedFingerprint);

      expect(
        await initRepo({ repository: `${repo.namespace}/${repo.name}` }),
      ).toEqual({
        defaultBranch: expectedDefaultBranch,
        isFork: false,
        repoFingerprint: expectedFingerprint,
      });

      expect(git.initRepo).toHaveBeenCalledWith({
        url: `https://${user.name}:${token}@localhost:8080/scm/default/repo`,
        repository,
        defaultBranch: expectedDefaultBranch,
      });
    });

    it('should throw error, because username is not provided in host rules', async () => {
      hostRules.clear();
      await expect(
        initRepo({ repository: `${repo.namespace}/${repo.name}` }),
      ).rejects.toThrow('Username is not provided');
    });

    it('should throw error, because token is not provided in host rules', async () => {
      hostRules.clear();
      hostRules.add({ username: user.name });
      await expect(
        initRepo({ repository: `${repo.namespace}/${repo.name}` }),
      ).rejects.toThrow('Token is not provided');
    });
  });

  describe(getRepos, () => {
    it('should return all available repos', async () => {
      httpMock
        .scope(endpoint)
        .get(`/repositories?pageSize=1000000`)
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            repositories: [
              repo,
              { ...repo, namespace: 'other', name: 'repository' },
              { ...repo, namespace: 'other', name: 'mercurial', type: 'hg' },
              { ...repo, namespace: 'other', name: 'subversion', type: 'svn' },
            ],
          },
        });

      expect(await getRepos()).toEqual(['default/repo', 'other/repository']);
    });
  });

  describe(getPrList, () => {
    it('should return empty array, because no PR could be found', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [],
          },
        });

      expect(await getPrList()).toIncludeAllMembers([]);
    });

    it('should return empty array, because API request failed', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(400);

      expect(await getPrList()).toIncludeAllMembers([]);
    });

    it('should return all PRs of a repo', async () => {
      const expectedResult: Pr[] = [
        {
          sourceBranch: pullRequest.source,
          createdAt: pullRequest.creationDate,
          labels: pullRequest.labels,
          number: parseInt(pullRequest.id),
          state: pullRequest.status,
          targetBranch: pullRequest.target,
          title: pullRequest.title,
          hasAssignees: false,
          isDraft: false,
          reviewers: [],
        },
      ];

      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [pullRequest],
          },
        });

      //Fetching from client
      expect(await getPrList()).toIncludeAllMembers(expectedResult);
      //Fetching from cache
      expect(await getPrList()).toIncludeAllMembers(expectedResult);
    });
  });

  describe(findPr, () => {
    it('search in Pull Request without explicitly setting the state as argument', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [pullRequest],
          },
        });

      expect(
        await findPr({
          branchName: pullRequest.source,
          prTitle: pullRequest.title,
        }),
      ).toEqual(renovatePr);
    });

    it.each([
      [[], pullRequest.source, pullRequest.title, 'all', null],
      [[pullRequest], 'invalid branchName', pullRequest.title, 'all', null],
      [[pullRequest], pullRequest.source, 'invalid title', 'all', null],
      [[pullRequest], pullRequest.source, null, 'all', renovatePr],
      [[pullRequest], pullRequest.source, undefined, 'all', renovatePr],
      [[pullRequest], pullRequest.source, pullRequest.title, 'all', renovatePr],
      [
        [pullRequest],
        pullRequest.source,
        pullRequest.title,
        'open',
        renovatePr,
      ],
      [[pullRequest], pullRequest.source, pullRequest.title, '!open', null],
      [[pullRequest], pullRequest.source, pullRequest.title, 'closed', null],
    ])(
      'search within %p for %p, %p, %p with result %p',
      async (
        availablePullRequest: PullRequest[],
        branchName: string,
        prTitle: string | null | undefined,
        state: string,
        result: Pr | null,
      ) => {
        httpMock
          .scope(endpoint)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
          )
          .reply(200, {
            page: 0,
            pageTotal: 1,
            _embedded: {
              pullRequests: availablePullRequest,
            },
          });

        expect(
          await findPr({
            branchName,
            prTitle,
            state: state as PrFilterByState,
          }),
        ).toEqual(result);
      },
    );
  });

  describe(getBranchPr, () => {
    it.each([
      [[], pullRequest.source, null],
      [[pullRequest], 'invalid branchName', null],
      [[pullRequest], pullRequest.source, renovatePr],
    ])(
      'search within %p for %p with result %p',
      async (
        availablePullRequest: PullRequest[],
        branchName: string,
        result: Pr | null,
      ) => {
        httpMock
          .scope(endpoint)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
          )
          .reply(200, {
            page: 0,
            pageTotal: 1,
            _embedded: {
              pullRequests: availablePullRequest,
            },
          });

        expect(await getBranchPr(branchName)).toEqual(result);
      },
    );
  });

  describe(getPr, () => {
    it('should return null, because PR was not found', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [],
          },
        });

      httpMock
        .scope(endpoint)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`)
        .reply(404);

      expect(await getPr(1)).toBeNull();
    });

    it('should return PR from cache', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [pullRequest],
          },
        });

      expect(await getPr(parseInt(pullRequest.id))).toEqual(renovatePr);
    });

    it('should return fetched pr', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: {
            pullRequests: [],
          },
        });

      httpMock
        .scope(endpoint)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`)
        .reply(200, pullRequest);

      expect(await getPr(parseInt(pullRequest.id))).toEqual(renovatePr);
    });
  });

  describe(createPr, () => {
    it.each([
      [undefined, 'OPEN', false],
      [false, 'OPEN', false],
      [true, 'DRAFT', true],
    ])(
      'it should create the PR with isDraft %p and state %p',
      async (
        draftPR: boolean | undefined,
        expectedState: string,
        expectedIsDraft: boolean,
      ) => {
        httpMock
          .scope(endpoint)
          .post(`/pull-requests/${repo.namespace}/${repo.name}`)
          .reply(201, undefined, {
            location: `${endpoint}/pull-requests/${repo.namespace}/${repo.name}/1337`,
          });

        httpMock
          .scope(endpoint)
          .get(`/pull-requests/${repo.namespace}/${repo.name}/1337`)
          .reply(200, {
            id: '1337',
            source: 'feature/test',
            target: 'develop',
            title: 'PR Title',
            description: 'PR Body',
            creationDate: '2023-01-01T13:37:00.000Z',
            status: draftPR ? 'DRAFT' : 'OPEN',
            labels: [],
            tasks: { todo: 0, done: 0 },
            _links: {},
            _embedded: {
              defaultConfig: {
                mergeStrategy: 'FAST_FORWARD_IF_POSSIBLE',
                deleteBranchOnMerge: false,
              },
            },
          });

        expect(
          await createPr({
            sourceBranch: 'feature/test',
            targetBranch: 'develop',
            prTitle: 'PR Title',
            prBody: 'PR Body',
            draftPR,
          }),
        ).toEqual({
          sourceBranch: 'feature/test',
          targetBranch: 'develop',
          title: 'PR Title',
          createdAt: '2023-01-01T13:37:00.000Z',
          hasAssignees: false,
          isDraft: expectedIsDraft,
          labels: [],
          number: 1337,
          reviewers: [],
          state: expectedState,
        });
      },
    );
  });

  describe(updatePr, () => {
    it.each([
      ['open', 'OPEN', 'prBody', 'prBody'],
      ['closed', 'REJECTED', 'prBody', 'prBody'],
      [undefined, undefined, 'prBody', 'prBody'],
      ['open', 'OPEN', undefined, undefined],
    ])(
      'it should update the PR with state %p and prBody %p',
      async (
        actualState: string | undefined,
        expectedState: string | undefined,
        actualPrBody: string | undefined,
        expectedPrBody: string | undefined,
      ) => {
        httpMock
          .scope(endpoint)
          .put(`/pull-requests/${repo.namespace}/${repo.name}/1`)
          .reply(204);

        await updatePr({
          number: 1,
          prTitle: 'PR Title',
          prBody: actualPrBody,
          state: actualState as 'open' | 'closed' | undefined,
          targetBranch: 'Target/Branch',
        });

        expect(httpMock.allUsed()).toBeTrue();
      },
    );
  });

  describe(mergePr, () => {
    it('should Not implemented and return false', async () => {
      const result = await mergePr({ id: 1 });
      expect(result).toBeFalse();
    });
  });

  describe(getBranchStatus, () => {
    it('should Not implemented and return red', async () => {
      const result = await getBranchStatus('test/branch', false);
      expect(result).toBe('red');
    });
  });

  describe(setBranchStatus, () => {
    it('should Not implemented', async () => {
      await expect(
        setBranchStatus({
          branchName: 'test/branch',
          context: 'context',
          description: 'description',
          state: 'red',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe(getBranchStatusCheck, () => {
    it('should Not implemented and return null', async () => {
      const result = await getBranchStatusCheck('test/branch', null);
      expect(result).toBeNull();
    });
  });

  describe(addReviewers, () => {
    it('should Not implemented', async () => {
      await expect(addReviewers(1, ['reviewer'])).resolves.not.toThrow();
    });
  });

  describe(addAssignees, () => {
    it('should Not implemented', async () => {
      await expect(addAssignees(1, ['assignee'])).resolves.not.toThrow();
    });
  });

  describe(deleteLabel, () => {
    it('should Not implemented', async () => {
      await expect(deleteLabel(1, 'label')).resolves.not.toThrow();
    });
  });

  describe(getIssueList, () => {
    it('should Not implemented and return empty list', async () => {
      const result = await getIssueList();
      expect(result).toEqual([]);
    });
  });

  describe(findIssue, () => {
    it('should Not implemented and return null', async () => {
      const result = await findIssue('issue');
      expect(result).toBeNull();
    });
  });

  describe(ensureIssue, () => {
    it('should Not implemented and return null', async () => {
      const result = await ensureIssue({ title: 'issue', body: 'body' });
      expect(result).toBeNull();
    });
  });

  describe(ensureIssueClosing, () => {
    it('should Not implemented', async () => {
      await expect(ensureIssueClosing('issue')).resolves.not.toThrow();
    });
  });

  describe(ensureCommentRemoval, () => {
    it('should Not implemented', async () => {
      await expect(
        ensureCommentRemoval({
          type: 'by-content',
          number: 1,
          content: 'content',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe(massageMarkdown, () => {
    it('should adjust smart link for Pull Requests', () => {
      const result = massageMarkdown('[PR](../pull/1)');
      expect(result).toBe('[PR](pulls/1)');
    });
  });

  describe(getRepoForceRebase, () => {
    it('should Not implemented and return false', async () => {
      const result = await getRepoForceRebase();
      expect(result).toBeFalse();
    });
  });

  describe(getRawFile, () => {
    it('should Not implemented and return null', async () => {
      const result = await getRawFile('file');
      expect(result).toBeNull();
    });
  });

  describe(getJsonFile, () => {
    it('should Not implemented and return undefined', async () => {
      const result = await getJsonFile('package.json');
      expect(result).toBeUndefined();
    });
  });

  describe(maxBodyLength, () => {
    it('should return the max body length allowed for an SCM-Manager request body', () => {
      expect(maxBodyLength()).toBe(200000);
    });
  });
});
