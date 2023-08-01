import * as httpMock from '../../../../test/http-mock';
import ScmClient from './scm-client';
import type {
  PullRequest,
  PullRequestCreateParams,
  PullRequestUpdateParams,
  Repo,
  User,
} from './types';

describe('modules/platform/scmm/scm-client', () => {
  const endpoint = 'http://localhost:8080/scm/api/v2';
  const token = 'validApiToken';

  const scmClient = new ScmClient(endpoint, token);

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
    author: { displayName: 'Thomas Zerr', username: 'tzerr' },
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

  describe(scmClient.getEndpoint, () => {
    it('should return the endpoint', () => {
      expect(scmClient.getEndpoint()).toEqual(endpoint);
    });
  });

  describe(scmClient.getCurrentUser, () => {
    it('should return the current user', async () => {
      const expectedUser: User = {
        mail: 'test@test.de',
        displayName: 'Test User',
        username: 'test',
      };

      httpMock.scope(endpoint).get('/me').reply(200, expectedUser);

      expect(await scmClient.getCurrentUser()).toEqual(expectedUser);
    });

    it.each([[401, 500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock.scope(endpoint).get('/me').reply(response);
        await expect(scmClient.getCurrentUser()).rejects.toThrow();
      },
    );
  });

  describe(scmClient.getRepo, () => {
    it('should return the repo', async () => {
      httpMock
        .scope(endpoint)
        .get(`/repositories/${repo.namespace}/${repo.name}`)
        .reply(200, repo);

      expect(await scmClient.getRepo(`${repo.namespace}/${repo.name}`)).toEqual(
        repo,
      );
    });

    it.each([[401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .get(`/repositories/${repo.namespace}/${repo.name}`)
          .reply(response);

        await expect(
          scmClient.getRepo(`${repo.namespace}/${repo.name}`),
        ).rejects.toThrow();
      },
    );
  });

  describe(scmClient.getAllRepos, () => {
    it('should return all repos', async () => {
      httpMock
        .scope(endpoint)
        .get('/repositories?pageSize=1000000')
        .reply(200, {
          page: 0,
          pageTotal: 1,
          _embedded: { repositories: [repo] },
        });

      expect(await scmClient.getAllRepos()).toEqual([repo]);
    });

    it.each([[401], [403], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .get('/repositories?pageSize=1000000')
          .reply(response);

        await expect(scmClient.getAllRepos()).rejects.toThrow();
      },
    );
  });

  describe(scmClient.getDefaultBranch, () => {
    it('should return the default branch', async () => {
      httpMock
        .scope(endpoint)
        .get('/config/git/default/repo/default-branch')
        .reply(200, {
          defaultBranch: 'develop',
        });

      expect(await scmClient.getDefaultBranch(repo)).toBe('develop');
    });

    it.each([[401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .get('/config/git/default/repo/default-branch')
          .reply(response);

        await expect(scmClient.getDefaultBranch(repo)).rejects.toThrow();
      },
    );
  });

  describe(scmClient.getAllRepoPrs, () => {
    it('should return all repo prs', async () => {
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
        await scmClient.getAllRepoPrs(`${repo.namespace}/${repo.name}`),
      ).toEqual([pullRequest]);
    });

    it.each([[401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}?status=ALL&pageSize=1000000`,
          )
          .reply(response);

        await expect(
          scmClient.getAllRepoPrs(`${repo.namespace}/${repo.name}`),
        ).rejects.toThrow();
      },
    );
  });

  describe(scmClient.getRepoPr, () => {
    it('should return the repo pr', async () => {
      httpMock
        .scope(endpoint)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`)
        .reply(200, pullRequest);

      expect(
        await scmClient.getRepoPr(`${repo.namespace}/${repo.name}`, 1337),
      ).toEqual(pullRequest);
    });

    it.each([[401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .get(
            `/pull-requests/${repo.namespace}/${repo.name}/${pullRequest.id}`,
          )
          .reply(response);

        await expect(
          scmClient.getRepoPr(`${repo.namespace}/${repo.name}`, 1337),
        ).rejects.toThrow();
      },
    );
  });

  describe(scmClient.createPr, () => {
    it('should create pr for a repo', async () => {
      const expectedCreateParams: PullRequestCreateParams = {
        source: 'feature/test',
        target: 'develop',
        title: 'Test Title',
        description: 'PR description',
        assignees: ['Test assignee'],
        status: 'OPEN',
      };

      const expectedPrId = 1337;

      httpMock
        .scope(endpoint)
        .post(`/pull-requests/${repo.namespace}/${repo.name}`)
        .reply(201, undefined, {
          location: `${endpoint}/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`,
        });

      httpMock
        .scope(endpoint)
        .get(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
        .reply(200, pullRequest);

      expect(
        await scmClient.createPr(
          `${repo.namespace}/${repo.name}`,
          expectedCreateParams,
        ),
      ).toEqual(pullRequest);
    });

    it.each([[400], [401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        httpMock
          .scope(endpoint)
          .post(`/pull-requests/${repo.namespace}/${repo.name}`)
          .reply(response);

        await expect(
          scmClient.createPr(`${repo.namespace}/${repo.name}`, {
            source: 'feature/test',
            target: 'develop',
            title: 'Test Title',
            description: 'PR description',
            assignees: ['Test assignee'],
            status: 'OPEN',
          }),
        ).rejects.toThrow();
      },
    );
  });

  describe(scmClient.updatePr, () => {
    it('should update pr for a repo', async () => {
      const expectedUpdateParams: PullRequestUpdateParams = {
        title: 'Test Title',
        description: 'PR description',
        assignees: ['Test assignee'],
        status: 'OPEN',
      };

      const expectedPrId = 1337;

      httpMock
        .scope(endpoint)
        .put(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
        .reply(204);

      await expect(
        scmClient.updatePr(
          `${repo.namespace}/${repo.name}`,
          expectedPrId,
          expectedUpdateParams,
        ),
      ).resolves.not.toThrow();
    });

    it.each([[400], [401], [403], [404], [500]])(
      'should throw %p response',
      async (response: number) => {
        const expectedPrId = 1337;

        httpMock
          .scope(endpoint)
          .put(`/pull-requests/${repo.namespace}/${repo.name}/${expectedPrId}`)
          .reply(response);

        await expect(
          scmClient.updatePr(`${repo.namespace}/${repo.name}`, expectedPrId, {
            title: 'Test Title',
            description: 'PR description',
            assignees: ['Test assignee'],
            status: 'OPEN',
          }),
        ).rejects.toThrow();
      },
    );
  });
});
