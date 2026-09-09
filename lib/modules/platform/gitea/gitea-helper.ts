import { isBoolean } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus } from '../../../types/index.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { GiteaHttp, type GiteaHttpOptions } from '../../../util/http/gitea.ts';
import { getQueryString } from '../../../util/url.ts';
import {
  Branch,
  Comment,
  CommitStatus,
  type CommitStatusType,
  Issue,
  Label,
  PR,
  Repo,
  RepoContents,
  RepoSearchResults,
  User,
  Version,
} from './schema.ts';
import type {
  CombinedCommitStatus,
  CommentCreateParams,
  CommitStatusCreateParams,
  GiteaLikeHttp,
  GiteaPlatformKey,
  IssueCreateParams,
  IssueSearchParams,
  IssueUpdateLabelsParams,
  IssueUpdateParams,
  PRCreateParams,
  PRMergeParams,
  PRUpdateParams,
  PrReviewersParams,
  RepoSearchParams,
} from './types.ts';
import { API_PATH } from './utils.ts';

export const giteaHttp = new GiteaHttp();

function urlEscape(raw: string): string {
  return encodeURIComponent(raw);
}
const commitStatusStates: CommitStatusType[] = [
  'unknown',
  'success',
  'pending',
  'warning',
  'failure',
  'error',
];

export async function getCurrentUser(
  http: GiteaLikeHttp,
  options: GiteaHttpOptions = {},
): Promise<User> {
  const url = `${API_PATH}/user`;
  const res = await http.getJson(url, options, User);
  return res.body;
}

export async function getVersion(
  http: GiteaLikeHttp,
  options: GiteaHttpOptions = {},
): Promise<string> {
  const url = `${API_PATH}/version`;
  const res = await http.getJson(url, options, Version);
  return res.body.version;
}

export async function isOrg(
  http: GiteaLikeHttp,
  platform: GiteaPlatformKey,
  organization: string,
): Promise<boolean> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  const platformCache = (repoCache.platform[platform] ??= {});
  platformCache.orgs ??= {};
  const cached = platformCache.orgs[organization];
  if (isBoolean(cached)) {
    return cached;
  }
  try {
    const url = `${API_PATH}/orgs/${organization}`;
    const res = await http.getJsonUnchecked(url);
    platformCache.orgs[organization] = res.statusCode === 200;
    return res.statusCode === 200;
  } catch (err) {
    if (err.statusCode === 404) {
      return false;
    }
    // throw other errors
    throw err;
  }
}

export async function searchRepos(
  http: GiteaLikeHttp,
  params: RepoSearchParams,
  options?: GiteaHttpOptions,
): Promise<Repo[]> {
  const query = getQueryString(params);
  const url = `${API_PATH}/repos/search?${query}`;
  const res = await http.getJson(
    url,
    {
      ...options,
      paginate: true,
    },
    RepoSearchResults,
  );

  if (!res.body.ok) {
    throw new Error(
      'Unable to search for repositories, ok flag has not been set',
    );
  }

  return res.body.data;
}

export async function orgListRepos(
  http: GiteaLikeHttp,
  organization: string,
  options?: GiteaHttpOptions,
): Promise<Repo[]> {
  const url = `${API_PATH}/orgs/${organization}/repos`;
  const res = await http.getJson(
    url,
    {
      ...options,
      paginate: true,
    },
    z.array(Repo),
  );

  return res.body;
}

export async function getRepo(
  http: GiteaLikeHttp,
  repoPath: string,
  options: GiteaHttpOptions = {},
): Promise<Repo> {
  const url = `${API_PATH}/repos/${repoPath}`;
  const res = await http.getJson(url, options, Repo);
  return res.body;
}

export async function getRepoContents(
  http: GiteaLikeHttp,
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options: GiteaHttpOptions = {},
): Promise<RepoContents> {
  const query = getQueryString(ref ? { ref } : {});
  const url = `${API_PATH}/repos/${repoPath}/contents/${urlEscape(
    filePath,
  )}?${query}`;
  const res = await http.getJson(url, options, RepoContents);

  return res.body;
}

export async function createPR(
  http: GiteaLikeHttp,
  repoPath: string,
  params: PRCreateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls`;
  const res = await http.postJson(
    url,
    {
      ...options,
      body: params,
    },
    PR,
  );

  return res.body;
}

export async function updatePR(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  params: PRUpdateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await http.patchJson(
    url,
    {
      ...options,
      body: params,
    },
    PR,
  );

  return res.body;
}

export async function closePR(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  await updatePR(http, repoPath, idx, {
    ...options,
    state: 'closed',
  });
}

export async function mergePR(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  params: PRMergeParams,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}/merge`;
  await http.postJson(url, {
    ...options,
    body: params,
  });
}

export async function getPR(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  options: GiteaHttpOptions = {},
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await http.getJson(url, options, PR);
  return res.body;
}

export async function getPRByBranch(
  http: GiteaLikeHttp,
  repoPath: string,
  base: string,
  head: string,
  options: GiteaHttpOptions = {},
): Promise<PR | null> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${base}/${head}`;
  try {
    const res = await http.getJson(url, options, PR);
    return res.body;
  } catch (err) {
    logger.trace({ err }, 'Error while fetching PR');
    if (err.statusCode !== 404) {
      logger.debug({ err }, 'Error while fetching PR');
    }
    return null;
  }
}

export async function requestPrReviewers(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  params: PrReviewersParams,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}/requested_reviewers`;
  await http.postJson(url, {
    ...options,
    body: params,
  });
}

export async function createIssue(
  http: GiteaLikeHttp,
  repoPath: string,
  params: IssueCreateParams,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues`;
  const res = await http.postJson(
    url,
    {
      ...options,
      body: params,
    },
    Issue,
  );

  return res.body;
}

export async function updateIssue(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  params: IssueUpdateParams,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await http.patchJson(
    url,
    {
      ...options,
      body: params,
    },
    Issue,
  );

  return res.body;
}

export async function updateIssueLabels(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  params: IssueUpdateLabelsParams,
  options?: GiteaHttpOptions,
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}/labels`;
  const res = await http.putJson(
    url,
    {
      ...options,
      body: params,
    },
    z.array(Label),
  );

  return res.body;
}

export async function closeIssue(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  await updateIssue(http, repoPath, idx, {
    ...options,
    state: 'closed',
  });
}

export async function searchIssues(
  http: GiteaLikeHttp,
  repoPath: string,
  params: IssueSearchParams,
  options?: GiteaHttpOptions,
): Promise<Issue[]> {
  const query = getQueryString({ ...params, type: 'issues' });
  const url = `${API_PATH}/repos/${repoPath}/issues?${query}`;
  const res = await http.getJson(
    url,
    {
      ...options,
      paginate: true,
    },
    z.array(Issue),
  );

  return res.body;
}

export async function getIssue(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  options: GiteaHttpOptions = {},
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await http.getJson(url, options, Issue);
  return res.body;
}

export async function getRepoLabels(
  http: GiteaLikeHttp,
  repoPath: string,
  options: GiteaHttpOptions = {},
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/labels`;
  const res = await http.getJson(url, options, z.array(Label));

  return res.body;
}

export async function getOrgLabels(
  http: GiteaLikeHttp,
  orgName: string,
  options: GiteaHttpOptions = {},
): Promise<Label[]> {
  const url = `${API_PATH}/orgs/${orgName}/labels`;
  const res = await http.getJson(url, options, z.array(Label));

  return res.body;
}

export async function unassignLabel(
  http: GiteaLikeHttp,
  repoPath: string,
  issue: number,
  label: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/labels/${label}`;
  await http.deleteJson(url, options);
}

export async function createComment(
  http: GiteaLikeHttp,
  repoPath: string,
  issue: number,
  body: string,
  options?: GiteaHttpOptions,
): Promise<Comment> {
  const params: CommentCreateParams = { body };
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/comments`;
  const res = await http.postJson(
    url,
    {
      ...options,
      body: params,
    },
    Comment,
  );

  return res.body;
}

export async function updateComment(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  body: string,
  options?: GiteaHttpOptions,
): Promise<Comment> {
  const params: CommentCreateParams = { body };
  const url = `${API_PATH}/repos/${repoPath}/issues/comments/${idx}`;
  const res = await http.patchJson(
    url,
    {
      ...options,
      body: params,
    },
    Comment,
  );

  return res.body;
}

export async function deleteComment(
  http: GiteaLikeHttp,
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/issues/comments/${idx}`;
  await http.deleteJson(url, options);
}

export async function getComments(
  http: GiteaLikeHttp,
  repoPath: string,
  issue: number,
  options: GiteaHttpOptions = {},
): Promise<Comment[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/comments`;
  const res = await http.getJson(url, options, z.array(Comment));

  return res.body;
}

export async function createCommitStatus(
  http: GiteaLikeHttp,
  repoPath: string,
  branchCommit: string,
  params: CommitStatusCreateParams,
  options?: GiteaHttpOptions,
): Promise<CommitStatus> {
  const url = `${API_PATH}/repos/${repoPath}/statuses/${branchCommit}`;
  const res = await http.postJson(
    url,
    {
      ...options,
      body: params,
    },
    CommitStatus,
  );

  return res.body;
}

export const toRenovateStatusMapping: Record<CommitStatusType, BranchStatus> = {
  unknown: 'yellow',
  success: 'green',
  pending: 'yellow',
  warning: 'red',
  failure: 'red',
  error: 'red',
};

export const toPlatformStatusMapping: Record<BranchStatus, CommitStatusType> = {
  green: 'success',
  yellow: 'pending',
  red: 'failure',
};

function filterStatus(data: CommitStatus[]): CommitStatus[] {
  const ret: Record<string, CommitStatus> = {};
  for (const i of data) {
    if (!ret[i.context] || ret[i.context].id < i.id) {
      ret[i.context] = i;
    }
  }
  return Object.values(ret);
}

export async function getCombinedCommitStatus(
  http: GiteaLikeHttp,
  repoPath: string,
  branchName: string,
  options?: GiteaHttpOptions,
): Promise<CombinedCommitStatus> {
  const url = `${API_PATH}/repos/${repoPath}/commits/${urlEscape(
    branchName,
  )}/statuses`;
  const res = await http.getJson(
    url,
    {
      ...options,
      paginate: true,
    },
    z.array(CommitStatus),
  );

  let worstState = 0;
  const statuses = filterStatus(res.body);
  for (const cs of statuses) {
    worstState = Math.max(worstState, commitStatusStates.indexOf(cs.status));
  }

  return {
    worstStatus: commitStatusStates[worstState],
    statuses,
  };
}

export async function getBranch(
  http: GiteaLikeHttp,
  repoPath: string,
  branchName: string,
  options: GiteaHttpOptions = {},
): Promise<Branch> {
  const url = `${API_PATH}/repos/${repoPath}/branches/${urlEscape(branchName)}`;
  const res = await http.getJson(url, options, Branch);

  return res.body;
}
