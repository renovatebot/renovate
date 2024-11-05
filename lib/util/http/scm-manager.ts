import {
  DefaultBranchSchema,
  PagedPullRequestSchema,
  PagedRepoSchema,
  PullRequestSchema,
  RepoSchema,
  UserSchema,
} from '../../modules/platform/scm-manager/schema';
import type {
  Link,
  PullRequest,
  PullRequestCreateParams,
  PullRequestUpdateParams,
  Repo,
  User,
} from '../../modules/platform/scm-manager/types';
import { resolveBaseUrl } from '../url';
import type { HttpOptions, HttpResponse, InternalHttpOptions } from './types';
import { Http } from './index';

const URLS = {
  ME: 'me',
  ALL_REPOS: 'repositories?pageSize=1000000',
  REPO: (repoPath: string) => `repositories/${repoPath}`,
  PULLREQUESTS: (repoPath: string) => `pull-requests/${repoPath}`,
  PULLREQUESTS_WITH_PAGINATION: (repoPath: string) =>
    `pull-requests/${repoPath}?status=ALL&pageSize=1000000`,
  PULLREQUEST_BY_ID: (repoPath: string, id: number) =>
    `pull-requests/${repoPath}/${id}`,
};

const CONTENT_TYPES = {
  ME: 'application/vnd.scmm-me+json;v=2',
  REPOSITORY: 'application/vnd.scmm-repository+json;v=2',
  REPOSITORIES: 'application/vnd.scmm-repositoryCollection+json;v=2',
  GIT_CONFIG: 'application/vnd.scmm-gitDefaultBranch+json;v=2',
  PULLREQUEST: 'application/vnd.scmm-pullRequest+json;v=2',
  PULLREQUESTS: 'application/vnd.scmm-pullRequestCollection+json;v=2',
};

export interface ScmManagerHttpOptions extends HttpOptions {
  scmmContentType?: string;
}

export default class ScmManagerHttp extends Http<ScmManagerHttpOptions> {
  private readonly endpoint: string;

  constructor(endpoint: string, token: string) {
    super('scm-manager', { throwHttpErrors: true, token });
    this.endpoint = endpoint;
  }

  protected override async request<T>(
    requestUrl: string | URL,
    options?: InternalHttpOptions & ScmManagerHttpOptions,
  ): Promise<HttpResponse<T>> {
    const opts = {
      ...options,
      headers: {
        ...options?.headers,
        accept: options?.scmmContentType,
      },
    };
    return await super.request(resolveBaseUrl(this.endpoint, requestUrl), opts);
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public async getCurrentUser(): Promise<User> {
    const response = await this.getJson(
      URLS.ME,
      {
        scmmContentType: CONTENT_TYPES.ME,
      },
      UserSchema,
    );
    return response.body;
  }

  public async getRepo(repoPath: string): Promise<Repo> {
    const response = await this.getJson(
      URLS.REPO(repoPath),
      {
        scmmContentType: CONTENT_TYPES.REPOSITORY,
      },
      RepoSchema,
    );
    return response.body;
  }

  public async getAllRepos(): Promise<Repo[]> {
    const response = await this.getJson(
      URLS.ALL_REPOS,
      {
        scmmContentType: CONTENT_TYPES.REPOSITORIES,
      },
      PagedRepoSchema,
    );

    return response.body._embedded.repositories;
  }

  public async getDefaultBranch(repo: Repo): Promise<string> {
    const defaultBranchUrl = repo._links['defaultBranch'] as Link;
    const response = await this.getJson(
      defaultBranchUrl.href,
      {
        scmmContentType: CONTENT_TYPES.GIT_CONFIG,
      },
      DefaultBranchSchema,
    );

    return response.body.defaultBranch;
  }

  public async getAllRepoPrs(repoPath: string): Promise<PullRequest[]> {
    const response = await this.getJson(
      URLS.PULLREQUESTS_WITH_PAGINATION(repoPath),
      {
        scmmContentType: CONTENT_TYPES.PULLREQUESTS,
      },
      PagedPullRequestSchema,
    );
    return response.body._embedded.pullRequests;
  }

  public async getRepoPr(repoPath: string, id: number): Promise<PullRequest> {
    const response = await this.getJson(
      URLS.PULLREQUEST_BY_ID(repoPath, id),
      {
        scmmContentType: CONTENT_TYPES.PULLREQUEST,
      },
      PullRequestSchema,
    );

    return response.body;
  }

  public async createPr(
    repoPath: string,
    params: PullRequestCreateParams,
  ): Promise<PullRequest> {
    const createPrResponse = await this.postJson(URLS.PULLREQUESTS(repoPath), {
      scmmContentType: CONTENT_TYPES.PULLREQUEST,
      body: params,
      headers: {
        'Content-Type': CONTENT_TYPES.PULLREQUEST,
      },
    });

    const getCreatedPrResponse = await this.getJson(
      /* istanbul ignore next: Just to please the compiler, location would never be undefined */
      createPrResponse.headers.location ?? '',
      {
        scmmContentType: CONTENT_TYPES.PULLREQUEST,
      },
      PullRequestSchema,
    );

    return getCreatedPrResponse.body;
  }

  public async updatePr(
    repoPath: string,
    id: number,
    params: PullRequestUpdateParams,
  ): Promise<void> {
    const currentPr = await this.getRepoPr(repoPath, id);
    await this.putJson(URLS.PULLREQUEST_BY_ID(repoPath, id), {
      body: this.mergePullRequestWithUpdate(currentPr, params),
      headers: {
        'Content-Type': CONTENT_TYPES.PULLREQUEST,
      },
    });
  }

  private mergePullRequestWithUpdate(
    pr: PullRequest,
    updateParams: PullRequestUpdateParams,
  ): PullRequest {
    return {
      ...pr,
      title: updateParams.title,
      description: updateParams.description
        ? updateParams.description
        : pr.description,
      status: updateParams.status ? updateParams.status : pr.status,
      target: updateParams.target ? updateParams.target : pr.target,
    };
  }
}
