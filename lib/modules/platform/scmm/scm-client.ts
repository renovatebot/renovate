import { Http } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { resolveBaseUrl } from '../../../util/url';
import type {
  Link,
  Page,
  PullRequest,
  PullRequestCreateParams,
  PullRequestPage,
  PullRequestUpdateParams,
  Repo,
  RepoPage,
  User,
} from './types';

const URLS = {
  ME: '/me',
  ALL_REPOS: 'repositories?pageSize=1000000',
  REPO: (repoPath: string) => `repositories/${repoPath}`,
  PULLREQUESTS: (repoPath: string) => `pull-requests/${repoPath}`,
  PULLREQUESTS_WITH_PAGINATION: (repoPath: string) =>
    `pull-requests/${repoPath}?status=ALL&pageSize=1000000`,
  PULLREQUEST_BY_ID: (repoPath: string, id: number) =>
    `pull-requests/${repoPath}/${id}`,
};

const CONTENT_TYPES = {
  PULLREQUESTS: 'application/vnd.scmm-pullrequest+json;v=2',
};

export default class ScmClient {
  private readonly httpClient: Http;
  private readonly endpoint: string;

  constructor(endpoint: string, token: string) {
    this.endpoint = endpoint;
    this.httpClient = new Http<HttpOptions>('scmm', {
      throwHttpErrors: true,
    });
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public async getCurrentUser(): Promise<User> {
    const response = await this.httpClient.getJson<User>(
      resolveBaseUrl(this.endpoint, URLS.ME),
    );
    return response.body;
  }

  public async getRepo(repoPath: string): Promise<Repo> {
    const response = await this.httpClient.getJson<Repo>(
      resolveBaseUrl(this.endpoint, URLS.REPO(repoPath)),
    );
    return response.body;
  }

  public async getAllRepos(): Promise<Repo[]> {
    const response = await this.httpClient.getJson<Page<RepoPage>>(
      resolveBaseUrl(this.endpoint, URLS.ALL_REPOS),
    );

    return response.body._embedded.repositories;
  }

  public async getDefaultBranch(repo: Repo): Promise<string> {
    const defaultBranchUrl = repo._links['defaultBranch'] as Link;
    const response = await this.httpClient.getJson<{ defaultBranch: string }>(
      defaultBranchUrl.href,
    );

    return response.body.defaultBranch;
  }

  public async getAllRepoPrs(repoPath: string): Promise<PullRequest[]> {
    const response = await this.httpClient.getJson<Page<PullRequestPage>>(
      resolveBaseUrl(
        this.endpoint,
        URLS.PULLREQUESTS_WITH_PAGINATION(repoPath),
      ),
    );
    return response.body._embedded.pullRequests;
  }

  public async getRepoPr(repoPath: string, id: number): Promise<PullRequest> {
    const response = await this.httpClient.getJson<PullRequest>(
      resolveBaseUrl(this.endpoint, URLS.PULLREQUEST_BY_ID(repoPath, id)),
    );

    return response.body;
  }

  public async createPr(
    repoPath: string,
    params: PullRequestCreateParams,
  ): Promise<PullRequest> {
    const createPrResponse = await this.httpClient.postJson(
      resolveBaseUrl(this.endpoint, URLS.PULLREQUESTS(repoPath)),
      {
        body: params,
        headers: {
          'Content-Type': CONTENT_TYPES.PULLREQUESTS,
        },
      },
    );

    const getCreatedPrResponse = await this.httpClient.getJson<PullRequest>(
      /* istanbul ignore next: Just to please the compiler, location would never be undefined */
      createPrResponse.headers.location ?? '',
    );

    return getCreatedPrResponse.body;
  }

  public async updatePr(
    repoPath: string,
    id: number,
    params: PullRequestUpdateParams,
  ): Promise<void> {
    await this.httpClient.putJson(
      resolveBaseUrl(this.endpoint, URLS.PULLREQUEST_BY_ID(repoPath, id)),
      {
        body: params,
        headers: {
          'Content-Type': CONTENT_TYPES.PULLREQUESTS,
        },
      },
    );
  }
}
