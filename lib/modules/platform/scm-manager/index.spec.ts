import * as httpMock from '../../../../test/http-mock';
import * as hostRules from '../../../util/host-rules';
import type { Pr } from '../types';
import * as util from '../util';
import { mapPrFromScmToRenovate } from './mapper';
import type { PullRequest, Repo, User } from './schema';
import type { PrFilterByState } from './types';
import * as scmPlatform from '.';
import { git } from '~test/util';

vi.mock('../util');
vi.mock('../../../util/git');

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

const renovatePr = mapPrFromScmToRenovate(pullRequest);

describe('modules/platform/scm-manager/index', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hostRules.add({ token, username: user.name });
    scmPlatform.invalidatePrCache();
  });

  describe(scmPlatform.initPlatform, () => {
    it('should throw error, when endpoint is not configured', async () => {
      await expect(scmPlatform.initPlatform({ token })).rejects.toThrow(
        'SCM-Manager endpoint not configured',
      );
    });

    it('should throw error, when token is not configured', async () => {
      await expect(scmPlatform.initPlatform({ endpoint })).rejects.toThrow(
        'SCM-Manager API token not configured',
      );
    });

    it('should throw error, when token is invalid', async () => {
      httpMock.scope(endpoint).get(`/me`).reply(401);

      await expect(
        scmPlatform.initPlatform({ endpoint, token: 'invalid' }),
      ).rejects.toThrow('Init: Authentication failure');
    });

    it('should init platform', async () => {
      httpMock.scope(endpoint).get('/me').reply(200, user);
      expect(await scmPlatform.initPlatform({ endpoint, token })).toEqual({
        endpoint,
        gitAuthor: 'Test User <test@user.de>',
      });
    });
  });

  describe(scmPlatform.initRepo, () => {
    it('should init repo', async () => {
      const repository = `${repo.namespace}/${repo.name}`;
      const expectedFingerprint = 'expectedFingerprint';
      const expectedDefaultBranch = 'expectedDefaultBranch';
      const expectedIgnorePrAuthor = true;

      httpMock
        .scope(endpoint)
        .get(`/repositories/${repository}`)
        .reply(200, repo);
      httpMock
        .scope(endpoint)
        .get(`/config/git/${repository}/default-branch`)
        .reply(200, { defaultBranch: expectedDefaultBranch });

      vi.mocked(util.repoFingerprint).mockReturnValueOnce(expectedFingerprint);

      expect(
        await scmPlatform.initRepo({
          repository: `${repo.namespace}/${repo.name}`,
          ignorePrAuthor: expectedIgnorePrAuthor,
        }),
      ).toEqual({
        defaultBranch: expectedDefaultBranch,
        isFork: false,
        repoFingerprint: expectedFingerprint,
      });

      expect(git.initRepo).toHaveBeenCalledExactlyOnceWith({
        url: `https://${user.name}:${token}@localhost:8080/scm/default/repo`,
        repository,
        defaultBranch: expectedDefaultBranch,
        ignorePrAuthor: expectedIgnorePrAuthor,
      });
    });
  });

  describe(scmPlatform.getRepos, () => {
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

      expect(await scmPlatform.getRepos()).toEqual([
        'default/repo',
        'other/repository',
      ]);
    });
  });

  describe(scmPlatform.getPrList, () => {
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

      expect(await scmPlatform.getPrList()).toBeEmptyArray();
    });

    it('should return empty array, because API request failed', async () => {
      httpMock
        .scope(endpoint)
        .get(
          `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
        )
        .reply(400);

      expect(await scmPlatform.getPrList()).toBeEmptyArray();
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
      expect(await scmPlatform.getPrList()).toIncludeAllMembers(expectedResult);
      //Fetching from cache
      expect(await scmPlatform.getPrList()).toIncludeAllMembers(expectedResult);
    });
  });

  describe(scmPlatform.findPr, () => {
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
        await scmPlatform.findPr({
          branchName: pullRequest.source,
          prTitle: pullRequest.title,
        }),
      ).toEqual(renovatePr);
    });

    it.each`
      availablePullRequest | branchName              | prTitle              | state       | result
      ${[]}                | ${pullRequest.source}   | ${pullRequest.title} | ${'all'}    | ${null}
      ${[pullRequest]}     | ${'invalid branchName'} | ${pullRequest.title} | ${'all'}    | ${null}
      ${[pullRequest]}     | ${pullRequest.source}   | ${'invalid title'}   | ${'all'}    | ${null}
      ${[pullRequest]}     | ${pullRequest.source}   | ${null}              | ${'all'}    | ${renovatePr}
      ${[pullRequest]}     | ${pullRequest.source}   | ${undefined}         | ${'all'}    | ${renovatePr}
      ${[pullRequest]}     | ${pullRequest.source}   | ${pullRequest.title} | ${'all'}    | ${renovatePr}
      ${[pullRequest]}     | ${pullRequest.source}   | ${pullRequest.title} | ${'open'}   | ${renovatePr}
      ${[pullRequest]}     | ${pullRequest.source}   | ${pullRequest.title} | ${'!open'}  | ${null}
      ${[pullRequest]}     | ${pullRequest.source}   | ${pullRequest.title} | ${'closed'} | ${null}
    `(
      'search within available pull requests for branch name "$branchName", pr title "$prTitle" and state "$state" with result $result',
      async ({
        availablePullRequest,
        branchName,
        prTitle,
        state,
        result,
      }: {
        availablePullRequest: PullRequest[];
        branchName: string;
        prTitle: string | undefined | null;
        state: string;
        result: Pr | null;
      }) => {
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
          await scmPlatform.findPr({
            branchName,
            prTitle,
            state: state as PrFilterByState,
          }),
        ).toEqual(result);
      },
    );
  });

  describe(scmPlatform.getBranchPr, () => {
    it.each`
      availablePullRequest | branchName              | result
      ${[]}                | ${pullRequest.source}   | ${null}
      ${[pullRequest]}     | ${'invalid branchName'} | ${null}
      ${[pullRequest]}     | ${pullRequest.source}   | ${renovatePr}
    `(
      'search within available pull requests for branch name "$branchName" with result $result',
      async ({
        availablePullRequest,
        branchName,
        result,
      }: {
        availablePullRequest: PullRequest[];
        branchName: string;
        result: Pr | null;
      }) => {
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

        expect(await scmPlatform.getBranchPr(branchName)).toEqual(result);
      },
    );
  });

  describe(scmPlatform.getPr, () => {
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

      expect(await scmPlatform.getPr(1)).toBeNull();
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

      expect(await scmPlatform.getPr(parseInt(pullRequest.id))).toEqual(
        renovatePr,
      );
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

      expect(await scmPlatform.getPr(parseInt(pullRequest.id))).toEqual(
        renovatePr,
      );
    });
  });

  describe(scmPlatform.createPr, () => {
    it.each`
      draftPr      | expectedState | expectedIsDraft
      ${undefined} | ${'OPEN'}     | ${false}
      ${false}     | ${'OPEN'}     | ${false}
      ${true}      | ${'DRAFT'}    | ${true}
    `(
      'should create PR with $draftPR and state $expectedState',
      async ({
        draftPr,
        expectedState,
        expectedIsDraft,
      }: {
        draftPr: boolean | undefined;
        expectedState: string;
        expectedIsDraft: boolean;
      }) => {
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
            status: draftPr ? 'DRAFT' : 'OPEN',
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
          await scmPlatform.createPr({
            sourceBranch: 'feature/test',
            targetBranch: 'develop',
            prTitle: 'PR Title',
            prBody: 'PR Body',
            draftPR: draftPr,
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

  describe(scmPlatform.updatePr, () => {
    it.each`
      state        | body
      ${'open'}    | ${'prBody'}
      ${'closed'}  | ${'prBody'}
      ${undefined} | ${'prBody'}
      ${'open'}    | ${undefined}
    `(
      'should update PR with state $state and bdoy $body',
      async ({
        state,
        body,
      }: {
        state: string | undefined;
        body: string | undefined;
      }) => {
        httpMock
          .scope(endpoint)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`,
          )
          .reply(200, pullRequest);

        httpMock
          .scope(endpoint)
          .put(`/pull-requests/${repo.namespace}/${repo.name}/1`)
          .reply(204);

        await expect(
          scmPlatform.updatePr({
            number: 1,
            prTitle: 'PR Title',
            prBody: body,
            state: state as 'open' | 'closed' | undefined,
            targetBranch: 'Target/Branch',
          }),
        ).resolves.not.toThrow();
      },
    );
  });

  describe(scmPlatform.mergePr, () => {
    it('should Not implemented and return false', async () => {
      const result = await scmPlatform.mergePr({ id: 1 });
      expect(result).toBeFalse();
    });
  });

  describe(scmPlatform.getBranchStatus, () => {
    it('should Not implemented and return red', async () => {
      const result = await scmPlatform.getBranchStatus('test/branch', false);
      expect(result).toBe('red');
    });
  });

  describe(scmPlatform.setBranchStatus, () => {
    it('should Not implemented', async () => {
      await expect(
        scmPlatform.setBranchStatus({
          branchName: 'test/branch',
          context: 'context',
          description: 'description',
          state: 'red',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.getBranchStatusCheck, () => {
    it('should Not implemented and return null', async () => {
      const result = await scmPlatform.getBranchStatusCheck(
        'test/branch',
        null,
      );
      expect(result).toBeNull();
    });
  });

  describe(scmPlatform.addReviewers, () => {
    it('should Not implemented', async () => {
      await expect(
        scmPlatform.addReviewers(1, ['reviewer']),
      ).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.addAssignees, () => {
    it('should Not implemented', async () => {
      await expect(
        scmPlatform.addAssignees(1, ['assignee']),
      ).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.deleteLabel, () => {
    it('should Not implemented', async () => {
      await expect(scmPlatform.deleteLabel(1, 'label')).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.getIssueList, () => {
    it('should Not implemented and return empty list', async () => {
      const result = await scmPlatform.getIssueList();
      expect(result).toEqual([]);
    });
  });

  describe(scmPlatform.findIssue, () => {
    it('should Not implemented and return null', async () => {
      const result = await scmPlatform.findIssue('issue');
      expect(result).toBeNull();
    });
  });

  describe(scmPlatform.ensureIssue, () => {
    it('should Not implemented and return null', async () => {
      const result = await scmPlatform.ensureIssue({
        title: 'issue',
        body: 'body',
      });
      expect(result).toBeNull();
    });
  });

  describe(scmPlatform.ensureIssueClosing, () => {
    it('should Not implemented', async () => {
      await expect(
        scmPlatform.ensureIssueClosing('issue'),
      ).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.ensureCommentRemoval, () => {
    it('should Not implemented', async () => {
      await expect(
        scmPlatform.ensureCommentRemoval({
          type: 'by-content',
          number: 1,
          content: 'content',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe(scmPlatform.ensureComment, () => {
    it('should Not implemented', async () => {
      expect(
        await scmPlatform.ensureComment({
          number: 1,
          topic: 'comment',
          content: 'content',
        }),
      ).toBeFalse();
    });
  });

  describe(scmPlatform.massageMarkdown, () => {
    it('should adjust smart link for Pull Requests', () => {
      const result = scmPlatform.massageMarkdown('[PR](../pull/1)');
      expect(result).toBe('[PR](pulls/1)');
    });
  });

  describe(scmPlatform.getRepoForceRebase, () => {
    it('should Not implemented and return false', async () => {
      const result = await scmPlatform.getRepoForceRebase();
      expect(result).toBeFalse();
    });
  });

  describe(scmPlatform.getRawFile, () => {
    it('should Not implemented and return null', async () => {
      const result = await scmPlatform.getRawFile('file');
      expect(result).toBeNull();
    });
  });

  describe(scmPlatform.getJsonFile, () => {
    it('should Not implemented and return undefined', async () => {
      const result = await scmPlatform.getJsonFile('package.json');
      expect(result).toBeNull();
    });
  });

  describe(scmPlatform.maxBodyLength, () => {
    it('should return the max body length allowed for an SCM-Manager request body', () => {
      expect(scmPlatform.maxBodyLength()).toBe(200000);
    });
  });
});
