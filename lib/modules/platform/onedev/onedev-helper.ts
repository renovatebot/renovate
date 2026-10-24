import type { ZodType } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import type { OnedevHttp } from '../../../util/http/onedev.ts';
import type { HttpOptions } from '../../../util/http/types.ts';
import { getQueryString } from '../../../util/url.ts';
import {
  type Build,
  BuildList,
  CloneUrl,
  type Issue,
  IssueList,
  NumericId,
  Project,
  ProjectList,
  type PullRequest,
  PullRequestList,
  User,
  type UserEmail,
  UserEmailList,
  UserId,
} from './schema.ts';
import type {
  AutoMergeParams,
  IssueCreateParams,
  IssueStateTransitionParams,
  OneDevCredentials,
  PullRequestCreateParams,
  PullRequestMergeStrategy,
} from './types.ts';

export const API_PATH = '~api';

let credentials: OneDevCredentials | undefined;

export function setCredentials(creds: OneDevCredentials): void {
  credentials = creds;
}

export function resetCredentials(): void {
  credentials = undefined;
}

function authOptions(): OneDevCredentials & Pick<HttpOptions, 'memCache'> {
  /* v8 ignore next -- credentials are always set by initPlatform first */
  if (!credentials) {
    throw new Error('OneDev helper called before credentials were set');
  }
  return {
    ...credentials,
    // Renovate's HTTP layer memoizes every GET request unless this is
    // disabled. The platform relies on re-fetching list endpoints (e.g. the
    // pull request list right after creating one), so responses must never
    // come from the memory cache.
    memCache: false,
  };
}

/**
 * Credentials to embed into git-over-HTTPS URLs - OneDev's git endpoints
 * expect HTTP Basic auth with the same credentials as the REST API.
 */
export function getCredentials(): OneDevCredentials {
  return authOptions();
}

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * Queries a OneDev list endpoint which pages results with the `offset` and
 * `count` query parameters.
 */
async function queryPaginated<T>(
  http: OnedevHttp,
  path: string,
  schema: ZodType<T[]>,
): Promise<T[]> {
  const items: T[] = [];
  for (
    let offset = 0, page = 0;
    page < MAX_PAGES;
    page++, offset += PAGE_SIZE
  ) {
    const url = `${path}?${getQueryString({ offset, count: PAGE_SIZE })}`;
    const { body } = await http.getJson(url, { ...authOptions() }, schema);
    items.push(...body);
    if (body.length < PAGE_SIZE) {
      break;
    }
  }
  return items;
}

/**
 * Encodes a project path for use in the `/projects/ids/{path}` endpoint,
 * which accepts unencoded slashes.
 */
function encodePathSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function getCurrentUser(http: OnedevHttp): Promise<User> {
  const { body } = await http.getJson('users/me', { ...authOptions() }, User);
  return body;
}

export async function getUserEmails(
  http: OnedevHttp,
  userId: number,
): Promise<UserEmail[]> {
  const { body } = await http.getJson(
    `users/${userId}/email-addresses`,
    { ...authOptions() },
    UserEmailList,
  );
  return body;
}

export async function getUserId(
  http: OnedevHttp,
  name: string,
): Promise<number> {
  const { body } = await http.getJson(
    `users/ids/${encodeURIComponent(name)}`,
    { ...authOptions() },
    UserId,
  );
  return body;
}

export async function queryProjects(http: OnedevHttp): Promise<Project[]> {
  const items = await queryPaginated(http, 'projects', ProjectList);
  logger.trace(`Retrieved ${items.length} projects`);
  return items;
}

export async function getProject(
  http: OnedevHttp,
  projectId: number,
): Promise<Project> {
  const { body } = await http.getJson(
    `projects/${projectId}`,
    { ...authOptions() },
    Project,
  );
  return body;
}

export async function getProjectId(
  http: OnedevHttp,
  path: string,
): Promise<number> {
  const { body } = await http.getJson(
    `projects/ids/${encodePathSegments(path)}`,
    { ...authOptions() },
    UserId,
  );
  return body;
}

export async function getCloneUrl(
  http: OnedevHttp,
  projectId: number,
): Promise<CloneUrl> {
  const { body } = await http.getJson(
    `projects/${projectId}/clone-url`,
    { ...authOptions() },
    CloneUrl,
  );
  return body;
}

export async function queryPullRequests(
  http: OnedevHttp,
): Promise<PullRequest[]> {
  const items = await queryPaginated(http, 'pulls', PullRequestList);
  logger.trace(`Retrieved ${items.length} pull requests`);
  return items;
}

export async function createPullRequest(
  http: OnedevHttp,
  params: PullRequestCreateParams,
): Promise<number | undefined> {
  const { body } = await http.postJson(
    'pulls',
    { ...authOptions(), body: params },
    NumericId,
  );
  return body;
}

export async function setPullRequestTitle(
  http: OnedevHttp,
  requestId: number,
  title: string,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/title`, {
    ...authOptions(),
    body: title,
  });
}

export async function setPullRequestDescription(
  http: OnedevHttp,
  requestId: number,
  description: string,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/description`, {
    ...authOptions(),
    body: description,
  });
}

export async function setPullRequestWorkInProgress(
  http: OnedevHttp,
  requestId: number,
  workInProgress: boolean,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/work-in-progress`, {
    ...authOptions(),
    body: workInProgress,
  });
}

export async function reopenPullRequest(
  http: OnedevHttp,
  requestId: number,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/reopen`, {
    ...authOptions(),
  });
}

export async function discardPullRequest(
  http: OnedevHttp,
  requestId: number,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/discard`, {
    ...authOptions(),
  });
}

export async function setPullRequestMergeStrategy(
  http: OnedevHttp,
  requestId: number,
  mergeStrategy: PullRequestMergeStrategy,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/merge-strategy`, {
    ...authOptions(),
    body: mergeStrategy,
  });
}

export async function setPullRequestAutoMerge(
  http: OnedevHttp,
  requestId: number,
  params: AutoMergeParams,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/auto-merge`, {
    ...authOptions(),
    body: params,
  });
}

export async function mergePullRequest(
  http: OnedevHttp,
  requestId: number,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/merge`, {
    ...authOptions(),
  });
}

export async function addPullRequestReviewer(
  http: OnedevHttp,
  requestId: number,
  userId: number,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/reviewers/${userId}`, {
    ...authOptions(),
  });
}

export async function addPullRequestAssignee(
  http: OnedevHttp,
  requestId: number,
  userId: number,
): Promise<void> {
  await http.postJson(`pulls/${requestId}/assignees/${userId}`, {
    ...authOptions(),
  });
}

export async function getPullRequestBuilds(
  http: OnedevHttp,
  requestId: number,
): Promise<Build[]> {
  const { body } = await http.getJson(
    `pulls/${requestId}/current-builds`,
    { ...authOptions() },
    BuildList,
  );
  return body;
}

export async function queryIssues(http: OnedevHttp): Promise<Issue[]> {
  const items = await queryPaginated(http, 'issues', IssueList);
  logger.trace(`Retrieved ${items.length} issues`);
  return items;
}

export async function createIssue(
  http: OnedevHttp,
  params: IssueCreateParams,
): Promise<number> {
  const { body } = await http.postJson(
    'issues',
    { ...authOptions(), body: params },
    NumericId,
  );
  return body;
}

export async function setIssueDescription(
  http: OnedevHttp,
  issueId: number,
  description: string,
): Promise<void> {
  await http.postJson(`issues/${issueId}/description`, {
    ...authOptions(),
    body: description,
  });
}

export async function transitIssueState(
  http: OnedevHttp,
  issueId: number,
  params: IssueStateTransitionParams,
): Promise<void> {
  await http.postJson(`issues/${issueId}/state-transitions`, {
    ...authOptions(),
    body: {
      state: params.state,
      comment: params.comment ?? '',
    },
  });
}
