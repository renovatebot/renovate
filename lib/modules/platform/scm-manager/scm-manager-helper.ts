import { ScmManagerHttp } from '../../../util/http/scm-manager';
import {
  DefaultBranchSchema,
  PagedPullRequestSchema,
  PagedRepoSchema,
  PullRequestSchema,
  RepoSchema,
  UserSchema,
} from './schema';
import type { Link, PullRequest, Repo, User } from './schema';
import type { PullRequestCreateParams, PullRequestUpdateParams } from './types';

/*let token: string;
export const setToken = (newToken: string): void => {
  token = newToken;
};*/

export const scmManagerHttp = new ScmManagerHttp();

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

export async function getCurrentUser(token: string): Promise<User> {
  const response = await scmManagerHttp.getJson(
    URLS.ME,
    {
      headers: { accept: CONTENT_TYPES.ME },
      token,
    },
    UserSchema,
  );
  return response.body;
}

export async function getRepo(repoPath: string): Promise<Repo> {
  const response = await scmManagerHttp.getJson(
    URLS.REPO(repoPath),
    {
      headers: { accept: CONTENT_TYPES.REPOSITORY },
    },
    RepoSchema,
  );
  return response.body;
}

export async function getAllRepos(): Promise<Repo[]> {
  const response = await scmManagerHttp.getJson(
    URLS.ALL_REPOS,
    {
      headers: { accept: CONTENT_TYPES.REPOSITORIES },
    },
    PagedRepoSchema,
  );

  return response.body._embedded.repositories;
}

export async function getDefaultBranch(repo: Repo): Promise<string> {
  const defaultBranchUrl = repo._links.defaultBranch as Link;
  const response = await scmManagerHttp.getJson(
    defaultBranchUrl.href,
    {
      headers: { accept: CONTENT_TYPES.GIT_CONFIG },
    },
    DefaultBranchSchema,
  );

  return response.body.defaultBranch;
}

export async function getAllRepoPrs(repoPath: string): Promise<PullRequest[]> {
  const response = await scmManagerHttp.getJson(
    URLS.PULLREQUESTS_WITH_PAGINATION(repoPath),
    {
      headers: { accept: CONTENT_TYPES.PULLREQUESTS },
    },
    PagedPullRequestSchema,
  );
  return response.body._embedded.pullRequests;
}

export async function getRepoPr(
  repoPath: string,
  id: number,
): Promise<PullRequest> {
  const response = await scmManagerHttp.getJson(
    URLS.PULLREQUEST_BY_ID(repoPath, id),
    {
      headers: { accept: CONTENT_TYPES.PULLREQUEST },
    },
    PullRequestSchema,
  );

  return response.body;
}

export async function createScmPr(
  repoPath: string,
  params: PullRequestCreateParams,
): Promise<PullRequest> {
  const createPrResponse = await scmManagerHttp.postJson(
    URLS.PULLREQUESTS(repoPath),
    {
      body: params,
      headers: {
        'Content-Type': CONTENT_TYPES.PULLREQUEST,
        accept: CONTENT_TYPES.PULLREQUEST,
      },
    },
  );

  const getCreatedPrResponse = await scmManagerHttp.getJson(
    createPrResponse.headers.location!,
    {
      headers: { accept: CONTENT_TYPES.PULLREQUEST },
    },
    PullRequestSchema,
  );

  return getCreatedPrResponse.body;
}

export async function updateScmPr(
  repoPath: string,
  id: number,
  params: PullRequestUpdateParams,
): Promise<void> {
  const currentPr = await getRepoPr(repoPath, id);
  await scmManagerHttp.putJson(URLS.PULLREQUEST_BY_ID(repoPath, id), {
    body: mergePullRequestWithUpdate(currentPr, params),
    headers: {
      'Content-Type': CONTENT_TYPES.PULLREQUEST,
    },
  });
}

function mergePullRequestWithUpdate(
  pr: PullRequest,
  updateParams: PullRequestUpdateParams,
): PullRequest {
  return {
    ...pr,
    title: updateParams.title,
    description: updateParams.description ?? pr.description,
    status: updateParams.status ?? pr.status,
    target: updateParams.target ?? pr.target,
  };
}
