import { setBaseUrl } from '../../../util/http/scm-manager';
import type { PullRequest, Repo, User } from './schema';
import {
  createScmPr,
  getAllRepoPrs,
  getAllRepos,
  getCurrentUser,
  getDefaultBranch,
  getRepo,
  getRepoPr,
  setToken,
  updateScmPr,
} from './scm-manager-helper';
import type { PullRequestCreateParams, PullRequestUpdateParams } from './types';
import * as httpMock from '~test/http-mock';

describe('modules/platform/scm-manager/scm-manager-helper', () => {
  const endpoint = 'http://localhost:8080/scm/api/v2';
  const token = 'apiToken';
  const expectingAuthHeader = {
    reqheaders: {
      authorization: `Bearer ${token}`,
    },
  };
  setBaseUrl(endpoint);
  setToken(token);

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
        { name: 'http', href: 'http://localhost:8080/scm/default/repo' },
      ],
      defaultBranch: {
        href: `${endpoint}/config/git/default/repo/default-branch`,
      },
    },
  };

  const pullRequest: PullRequest = {
    id: '1337',
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

  describe(getCurrentUser, () => {
    it('should return the current user', async () => {
      const expectedUser: User = {
        mail: 'test@test.de',
        displayName: 'Test User',
        name: 'test',
      };

      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get('/me')
        .reply(200, expectedUser);

      expect(await getCurrentUser()).toEqual(expectedUser);
    });

    it.each`
      expectedResponse
      ${401}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get('/me')
          .reply(expectedResponse);
        await expect(getCurrentUser()).rejects.toThrow();
      },
    );
  });

  describe(getRepo, () => {
    it('should return the repo', async () => {
      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get(`/repositories/${repo.namespace}/${repo.name}`)
        .reply(200, repo);

      expect(await getRepo(`${repo.namespace}/${repo.name}`)).toEqual(repo);
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get(`/repositories/${repo.namespace}/${repo.name}`)
          .reply(expectedResponse);

        await expect(
          getRepo(`${repo.namespace}/${repo.name}`),
        ).rejects.toThrow();
      },
    );
  });

  describe(getAllRepos, () => {
    it('should return all repos', async () => {
      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get('/repositories?pageSize=1000000')
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: { repositories: [repo] },
        });

      expect(await getAllRepos()).toEqual([repo]);
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get('/repositories?pageSize=1000000')
          .reply(expectedResponse);

        await expect(getAllRepos()).rejects.toThrow();
      },
    );
  });

  describe(getDefaultBranch, () => {
    it('should return the default branch', async () => {
      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get('/config/git/default/repo/default-branch')
        .reply(200, {
          defaultBranch: 'develop',
        });

      expect(await getDefaultBranch(repo)).toBe('develop');
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get('/config/git/default/repo/default-branch')
          .reply(expectedResponse);

        await expect(getDefaultBranch(repo)).rejects.toThrow();
      },
    );
  });

  describe(getAllRepoPrs, () => {
    it('should return all repo PRs', async () => {
      httpMock
        .scope(endpoint, expectingAuthHeader)
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

      expect(await getAllRepoPrs(`${repo.namespace}/${repo.name}`)).toEqual([
        pullRequest,
      ]);
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
          )
          .reply(expectedResponse);

        await expect(
          getAllRepoPrs(`${repo.namespace}/${repo.name}`),
        ).rejects.toThrow();
      },
    );
  });

  describe(getRepoPr, () => {
    it('should return the repo PR', async () => {
      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`)
        .reply(200, pullRequest);

      expect(await getRepoPr(`${repo.namespace}/${repo.name}`, 1337)).toEqual(
        pullRequest,
      );
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`,
          )
          .reply(expectedResponse);

        await expect(
          getRepoPr(`${repo.namespace}/${repo.name}`, 1337),
        ).rejects.toThrow();
      },
    );
  });

  describe(createScmPr, () => {
    it('should create PR for a repo', async () => {
      const expectedCreateParams: PullRequestCreateParams = {
        source: 'feature/test',
        target: 'develop',
        title: 'Test Title',
        description: 'PR description',
        status: 'OPEN',
      };

      const expectedPrId = 1337;

      httpMock
        .scope(endpoint, expectingAuthHeader)
        .post(`/pull-requests/${repo.namespace}/${repo.name}`)
        .reply(201, undefined, {
          location: `${endpoint}/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`,
        });

      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
        .reply(200, pullRequest);

      expect(
        await createScmPr(
          `${repo.namespace}/${repo.name}`,
          expectedCreateParams,
        ),
      ).toEqual(pullRequest);
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        httpMock
          .scope(endpoint, expectingAuthHeader)
          .post(`/pull-requests/${repo.namespace}/${repo.name}`)
          .reply(expectedResponse);

        await expect(
          createScmPr(`${repo.namespace}/${repo.name}`, {
            source: 'feature/test',
            target: 'develop',
            title: 'Test Title',
            description: 'PR description',
            status: 'OPEN',
          }),
        ).rejects.toThrow();
      },
    );
  });

  describe(updateScmPr, () => {
    it('should update PR for a repo', async () => {
      const expectedUpdateParams: PullRequestUpdateParams = {
        title: 'Test Title',
        description: 'PR description',
        status: 'OPEN',
        target: 'new/target',
      };

      const expectedPrId = 1337;

      httpMock
        .scope(endpoint, expectingAuthHeader)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
        .reply(200, pullRequest);

      httpMock
        .scope(endpoint, expectingAuthHeader)
        .put(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
        .reply(204);

      await expect(
        updateScmPr(
          `${repo.namespace}/${repo.name}`,
          expectedPrId,
          expectedUpdateParams,
        ),
      ).resolves.not.toThrow();
    });

    it.each`
      expectedResponse
      ${401}
      ${403}
      ${404}
      ${500}
    `(
      'should throw expected response $expectedResponse',
      async ({ expectedResponse }: { expectedResponse: number }) => {
        const expectedPrId = 1337;

        httpMock
          .scope(endpoint, expectingAuthHeader)
          .get(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
          .reply(200, pullRequest);

        httpMock
          .scope(endpoint, expectingAuthHeader)
          .put(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
          .reply(expectedResponse);

        await expect(
          updateScmPr(`${repo.namespace}/${repo.name}`, expectedPrId, {
            title: 'Test Title',
            description: 'PR description',
            status: 'OPEN',
          }),
        ).rejects.toThrow();
      },
    );
  });
});
