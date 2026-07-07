import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus } from '../../../types/index.ts';
import type { GiteaHttpOptions } from '../../../util/http/gitea.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
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
  CommentUpdateParams,
  CommitStatusCreateParams,
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

const urlEscape = (raw: string): string => encodeURIComponent(raw);
const commitStatusStates: CommitStatusType[] = [
  'unknown',
  'success',
  'pending',
  'warning',
  'failure',
  'error',
];

export async function getCurrentUser(
  options: GiteaHttpOptions = {},
): Promise<User> {
  const url = `${API_PATH}/user`;
  const res = await giteaHttp.getJson(url, options, User);
  return res.body;
}

export async function getVersion(
  options: GiteaHttpOptions = {},
): Promise<string> {
  const url = `${API_PATH}/version`;
  const res = await giteaHttp.getJson(url, options, Version);
  return res.body.version;
}

export async function searchRepos(
  params: RepoSearchParams,
  options?: GiteaHttpOptions,
): Promise<Repo[]> {
  const query = getQueryString(params);
  const url = `${API_PATH}/repos/search?${query}`;
  const res = await giteaHttp.getJson(
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
  organization: string,
  options?: GiteaHttpOptions,
): Promise<Repo[]> {
  const url = `${API_PATH}/orgs/${organization}/repos`;
  const res = await giteaHttp.getJson(
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
  repoPath: string,
  options: GiteaHttpOptions = {},
): Promise<Repo> {
  const url = `${API_PATH}/repos/${repoPath}`;
  const res = await giteaHttp.getJson(url, options, Repo);
  return res.body;
}

export async function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options: GiteaHttpOptions = {},
): Promise<RepoContents> {
  const query = getQueryString(ref ? { ref } : {});
  const url = `${API_PATH}/repos/${repoPath}/contents/${urlEscape(
    filePath,
  )}?${query}`;
  const res = await giteaHttp.getJson(url, options, RepoContents);

  return res.body;
}

export async function createPR(
  repoPath: string,
  params: PRCreateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls`;
  const res = await giteaHttp.postJson(
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
  repoPath: string,
  idx: number,
  params: PRUpdateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.patchJson(
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
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  await updatePR(repoPath, idx, {
    ...options,
    state: 'closed',
  });
}

export async function mergePR(
  repoPath: string,
  idx: number,
  params: PRMergeParams,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}/merge`;
  await giteaHttp.postJson(url, {
    ...options,
    body: params,
  });
}

export async function getPR(
  repoPath: string,
  idx: number,
  options: GiteaHttpOptions = {},
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.getJson(url, options, PR);
  return res.body;
}

export async function getPRByBranch(
  repoPath: string,
  base: string,
  head: string,
  options: GiteaHttpOptions = {},
): Promise<PR | null> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${base}/${head}`;
  try {
    const res = await giteaHttp.getJson(url, options, PR);
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
  repoPath: string,
  idx: number,
  params: PrReviewersParams,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}/requested_reviewers`;
  await giteaHttp.postJson(url, {
    ...options,
    body: params,
  });
}

export async function createIssue(
  repoPath: string,
  params: IssueCreateParams,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues`;
  const res = await giteaHttp.postJson(
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
  repoPath: string,
  idx: number,
  params: IssueUpdateParams,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await giteaHttp.patchJson(
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
  repoPath: string,
  idx: number,
  params: IssueUpdateLabelsParams,
  options?: GiteaHttpOptions,
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}/labels`;
  const res = await giteaHttp.putJson(
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
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  await updateIssue(repoPath, idx, {
    ...options,
    state: 'closed',
  });
}

export async function searchIssues(
  repoPath: string,
  params: IssueSearchParams,
  options?: GiteaHttpOptions,
): Promise<Issue[]> {
  const query = getQueryString({ ...params, type: 'issues' });
  const url = `${API_PATH}/repos/${repoPath}/issues?${query}`;
  const res = await giteaHttp.getJson(
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
  repoPath: string,
  idx: number,
  options: GiteaHttpOptions = {},
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await giteaHttp.getJson(url, options, Issue);
  return res.body;
}

export async function getRepoLabels(
  repoPath: string,
  options: GiteaHttpOptions = {},
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/labels`;
  const res = await giteaHttp.getJson(url, options, z.array(Label));

  return res.body;
}

export async function getOrgLabels(
  orgName: string,
  options: GiteaHttpOptions = {},
): Promise<Label[]> {
  const url = `${API_PATH}/orgs/${orgName}/labels`;
  const res = await giteaHttp.getJson(url, options, z.array(Label));

  return res.body;
}

export async function unassignLabel(
  repoPath: string,
  issue: number,
  label: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/labels/${label}`;
  await giteaHttp.deleteJson(url, options);
}

export async function createComment(
  repoPath: string,
  issue: number,
  body: string,
  options?: GiteaHttpOptions,
): Promise<Comment> {
  const params: CommentCreateParams = { body };
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/comments`;
  const res = await giteaHttp.postJson(
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
  repoPath: string,
  idx: number,
  body: string,
  options?: GiteaHttpOptions,
): Promise<Comment> {
  const params: CommentUpdateParams = { body };
  const url = `${API_PATH}/repos/${repoPath}/issues/comments/${idx}`;
  const res = await giteaHttp.patchJson(
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
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<void> {
  const url = `${API_PATH}/repos/${repoPath}/issues/comments/${idx}`;
  await giteaHttp.deleteJson(url, options);
}

export async function getComments(
  repoPath: string,
  issue: number,
  options: GiteaHttpOptions = {},
): Promise<Comment[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/comments`;
  const res = await giteaHttp.getJson(url, options, z.array(Comment));

  return res.body;
}

export async function createCommitStatus(
  repoPath: string,
  branchCommit: string,
  params: CommitStatusCreateParams,
  options?: GiteaHttpOptions,
): Promise<CommitStatus> {
  const url = `${API_PATH}/repos/${repoPath}/statuses/${branchCommit}`;
  const res = await giteaHttp.postJson(
    url,
    {
      ...options,
      body: params,
    },
    CommitStatus,
  );

  return res.body;
}

export const giteaToRenovateStatusMapping: Record<
  CommitStatusType,
  BranchStatus
> = {
  unknown: 'yellow',
  success: 'green',
  pending: 'yellow',
  warning: 'red',
  failure: 'red',
  error: 'red',
};

export const renovateToGiteaStatusMapping: Record<
  BranchStatus,
  CommitStatusType
> = {
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
  repoPath: string,
  branchName: string,
  options?: GiteaHttpOptions,
): Promise<CombinedCommitStatus> {
  const url = `${API_PATH}/repos/${repoPath}/commits/${urlEscape(
    branchName,
  )}/statuses`;
  const res = await giteaHttp.getJson(
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
  repoPath: string,
  branchName: string,
  options: GiteaHttpOptions = {},
): Promise<Branch> {
  const url = `${API_PATH}/repos/${repoPath}/branches/${urlEscape(branchName)}`;
  const res = await giteaHttp.getJson(url, options, Branch);

  return res.body;
}
