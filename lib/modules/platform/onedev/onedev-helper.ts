import { isString } from '@sindresorhus/is';
import type { HTTPError } from 'got';
import type { ZodType } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import type { OnedevHttp } from '../../../util/http/onedev.ts';
import type { HttpOptions } from '../../../util/http/types.ts';
import { regEx } from '../../../util/regex.ts';
import { getQueryString } from '../../../util/url.ts';
import {
  type Build,
  BuildList,
  CloneUrl,
  type Issue,
  IssueList,
  IssueSettings,
  NumericId,
  Project,
  ProjectList,
  type PullRequest,
  type PullRequestComment,
  PullRequestCommentList,
  PullRequestList,
  RepositoryFile,
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
  PullRequestCommentCreateParams,
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

function authOptions(): OneDevCredentials {
  /* v8 ignore next -- credentials are always set by initPlatform first */
  if (!credentials) {
    throw new Error('OneDev helper called before credentials were set');
  }
  return credentials;
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
  extraOptions: HttpOptions = authOptions(),
): Promise<T[]> {
  const items: T[] = [];
  for (
    let offset = 0, page = 0;
    page < MAX_PAGES;
    page++, offset += PAGE_SIZE
  ) {
    const url = `${path}?${getQueryString({ offset, count: PAGE_SIZE })}`;
    const { body } = await http.getJson(url, extraOptions, schema);
    items.push(...body);
    if (body.length < PAGE_SIZE) {
      break;
    }
  }
  return items;
}

/**
 * Query parameter and auth options which disable the HTTP memory cache, for
 * endpoints whose response is expected to change within a run (list endpoints
 * re-read after mutations, and build statuses polled until they turn green).
 */
export function freshOptions(): HttpOptions {
  return { ...authOptions(), memCache: false };
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
  // The list is re-read right after mutations (e.g. PR creation); serving it
  // from the memory cache would return the pre-mutation result.
  const items = await queryPaginated(
    http,
    'pulls',
    PullRequestList,
    freshOptions(),
  );
  logger.trace(`Retrieved ${items.length} pull requests`);
  return items;
}

export async function createPullRequest(
  http: OnedevHttp,
  params: PullRequestCreateParams,
): Promise<number> {
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
  await http.postPlain(`pulls/${requestId}/title`, title, {
    ...authOptions(),
    headers: { 'content-type': 'application/json' },
  });
}

export async function setPullRequestDescription(
  http: OnedevHttp,
  requestId: number,
  description: string,
): Promise<void> {
  await http.postPlain(`pulls/${requestId}/description`, description, {
    ...authOptions(),
    headers: { 'content-type': 'application/json' },
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
    freshOptions(),
    BuildList,
  );
  return body;
}

export async function queryIssues(http: OnedevHttp): Promise<Issue[]> {
  // The list is re-read right after issue mutations; serving it from the
  // memory cache would return the pre-mutation result.
  const items = await queryPaginated(http, 'issues', IssueList, freshOptions());
  logger.trace(`Retrieved ${items.length} issues`);
  return items;
}

/**
 * Default values for OneDev's built-in issue form fields, which instances
 * may require even though they have no server-side default. Both fields ship
 * with OneDev itself and cannot be renamed, so they can be looked up by
 * name.
 */
const WellKnownIssueFieldValues: Record<string, string> = {
  Type: 'Task',
  Priority: 'Normal',
};

async function createIssueRequest(
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

/**
 * Reads the instance's issue form field specs and returns values for the
 * built-in fields required by the instance (e.g. `Type: 'Task'`,
 * `Priority: 'Normal'`). Fields without a fitting known value are skipped.
 * An empty map is returned when the specs are not readable: reading them
 * needs an administrator account, and non-admin REST users instead rely on
 * the retry inside `createIssue()`.
 */
export async function getIssueFieldDefaults(
  http: OnedevHttp,
): Promise<Record<string, string>> {
  try {
    const { body } = await http.getJson(
      'settings/issue',
      { ...authOptions() },
      IssueSettings,
    );
    const values: Record<string, string> = {};
    for (const spec of coerceArray(body.fieldSpecs)) {
      if (spec.allowEmpty !== false) {
        continue;
      }
      const wellKnown = WellKnownIssueFieldValues[spec.name];
      if (!wellKnown) {
        continue;
      }
      if (
        spec.choiceProvider?.choices?.some(
          (choice) => choice.value === wellKnown,
        )
      ) {
        values[spec.name] = wellKnown;
      }
    }
    return values;
  } catch (err) {
    logger.debug(
      { err },
      'Cannot read OneDev issue form field specs, creating issues without pre-filled field values',
    );
    return {};
  }
}

/**
 * Parses the missing required issue form fields out of OneDev's
 * `Invalid fields` validation error, mapping each field to its allowed
 * choice values (non-choice fields get an empty list), e.g.
 *
 * ```
 * Invalid fields: Type (value must not be empty, and should take one of:
 * Enhancement, Bug, Task), Priority (value must not be empty)
 * ```
 *
 * Returns `undefined` for any other error body.
 */
export function parseIssueFieldValidationError(
  body: string,
): Record<string, string[]> | undefined {
  const prefix = 'Invalid fields: ';
  if (!body.startsWith(prefix)) {
    return undefined;
  }
  const result: Record<string, string[]> = {};
  // OneDev emits every missing field as `Name (reason)`, where the reason
  // may itself contain commas (choice lists) - hence the paren-based scan
  // instead of a simple split.
  const entries = body.slice(prefix.length);
  const pattern = regEx(/(?<name>[^,()]*) \((?<reason>[^()]*)\)/g);
  let match = pattern.exec(entries);
  while (match !== null) {
    const { name, reason } = match.groups!;
    const choices: string[] = [];
    const takeIndex = reason.indexOf('should take one');
    if (takeIndex >= 0) {
      const colonIndex = reason.indexOf(': ', takeIndex);
      if (colonIndex >= 0) {
        choices.push(...reason.slice(colonIndex + 2).split(', '));
      }
    }
    result[name.trim()] = choices;
    match = pattern.exec(entries);
  }
  return Object.keys(result).length ? result : undefined;
}

export async function createIssue(
  http: OnedevHttp,
  params: IssueCreateParams,
): Promise<number> {
  try {
    return await createIssueRequest(http, params);
  } catch (err) {
    // OneDev rejects issue creation when its issue form requires field
    // values not supplied by the client. For the built-in Type/Priority
    // fields OneDev's error body lists the missing fields together with
    // their allowed choices - use them to retry once.
    const response = (err as HTTPError).response;
    if (response?.statusCode !== 400) {
      throw err;
    }
    if (!isString(response.body)) {
      throw err;
    }
    const missing = parseIssueFieldValidationError(response.body);
    if (!missing) {
      throw err;
    }
    // Any missing field without a matching built-in value keeps the request
    // failing no matter what Renovate guesses - rethrow the original error.
    const fields = { ...params.fields };
    for (const [name, choices] of Object.entries(missing)) {
      const value = WellKnownIssueFieldValues[name];
      if (!value || !choices.includes(value)) {
        throw err;
      }
      fields[name] = value;
    }
    return createIssueRequest(http, { ...params, fields });
  }
}

export async function setIssueDescription(
  http: OnedevHttp,
  issueId: number,
  description: string,
): Promise<void> {
  await http.postPlain(`issues/${issueId}/description`, description, {
    ...authOptions(),
    headers: { 'content-type': 'application/json' },
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

export async function getPullRequestComments(
  http: OnedevHttp,
  requestId: number,
): Promise<PullRequestComment[]> {
  // Comments may change both through Renovate itself and through the web
  // UI - always read them fresh.
  const { body } = await http.getJson(
    `pulls/${requestId}/comments`,
    freshOptions(),
    PullRequestCommentList,
  );
  return body;
}

export async function createPullRequestComment(
  http: OnedevHttp,
  params: PullRequestCommentCreateParams,
): Promise<number> {
  const { body } = await http.postJson(
    'pull-request-comments',
    { ...authOptions(), body: params },
    NumericId,
  );
  return body;
}

export async function updatePullRequestComment(
  http: OnedevHttp,
  commentId: number,
  content: string,
): Promise<void> {
  await http.postPlain(`pull-request-comments/${commentId}`, content, {
    ...authOptions(),
    headers: { 'content-type': 'application/json' },
  });
}

export async function deletePullRequestComment(
  http: OnedevHttp,
  commentId: number,
): Promise<void> {
  await http.deleteJson(`pull-request-comments/${commentId}`, {
    ...authOptions(),
  });
}

export async function getDefaultBranch(
  http: OnedevHttp,
  projectId: number,
): Promise<string | undefined> {
  const { body } = await http.getPlain(
    `repositories/${projectId}/default-branch`,
    { ...authOptions() },
  );
  const branch = body.trim();
  return branch === '' ? undefined : branch;
}

export async function getRepositoryFile(
  http: OnedevHttp,
  projectId: number,
  file: string,
  revision: string,
): Promise<RepositoryFile> {
  const { body } = await http.getJson(
    `repositories/${projectId}/files?${getQueryString({ revision, file })}`,
    authOptions(),
    RepositoryFile,
  );
  return body;
}
