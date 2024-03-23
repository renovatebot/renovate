import type { BranchStatus } from '../../../types';
import { GiteaHttp, GiteaHttpOptions } from '../../../util/http/gitea';
import { getQueryString } from '../../../util/url';
import type {
  Branch,
  CombinedCommitStatus,
  Comment,
  CommentCreateParams,
  CommentUpdateParams,
  CommitStatus,
  CommitStatusCreateParams,
  CommitStatusType,
  Issue,
  IssueCreateParams,
  IssueSearchParams,
  IssueUpdateLabelsParams,
  IssueUpdateParams,
  Label,
  PR,
  PRCreateParams,
  PRMergeParams,
  PRUpdateParams,
  PrReviewersParams,
  Repo,
  RepoContents,
  RepoSearchParams,
  RepoSearchResults,
  User,
} from './types';
import { API_PATH } from './utils';

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
  options?: GiteaHttpOptions,
): Promise<User> {
  const url = `${API_PATH}/user`;
  const res = await giteaHttp.getJson<User>(url, options);
  return res.body;
}

export async function getVersion(options?: GiteaHttpOptions): Promise<string> {
  const url = `${API_PATH}/version`;
  const res = await giteaHttp.getJson<{ version: string }>(url, options);
  return res.body.version;
}

export async function searchRepos(
  params: RepoSearchParams,
  options?: GiteaHttpOptions,
): Promise<Repo[]> {
  const query = getQueryString(params);
  const url = `${API_PATH}/repos/search?${query}`;
  const res = await giteaHttp.getJson<RepoSearchResults>(url, {
    ...options,
    paginate: true,
  });

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
  const res = await giteaHttp.getJson<Repo[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function getRepo(
  repoPath: string,
  options?: GiteaHttpOptions,
): Promise<Repo> {
  const url = `${API_PATH}/repos/${repoPath}`;
  const res = await giteaHttp.getJson<Repo>(url, options);
  return res.body;
}

export async function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options?: GiteaHttpOptions,
): Promise<RepoContents> {
  const query = getQueryString(ref ? { ref } : {});
  const url = `${API_PATH}/repos/${repoPath}/contents/${urlEscape(
    filePath,
  )}?${query}`;
  const res = await giteaHttp.getJson<RepoContents>(url, options);

  if (res.body.content) {
    res.body.contentString = Buffer.from(res.body.content, 'base64').toString();
  }

  return res.body;
}

export async function createPR(
  repoPath: string,
  params: PRCreateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls`;
  const res = await giteaHttp.postJson<PR>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updatePR(
  repoPath: string,
  idx: number,
  params: PRUpdateParams,
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.patchJson<PR>(url, {
    ...options,
    body: params,
  });

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
  options?: GiteaHttpOptions,
): Promise<PR> {
  const url = `${API_PATH}/repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.getJson<PR>(url, options);
  return res.body;
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
  const res = await giteaHttp.postJson<Issue>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updateIssue(
  repoPath: string,
  idx: number,
  params: IssueUpdateParams,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await giteaHttp.patchJson<Issue>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updateIssueLabels(
  repoPath: string,
  idx: number,
  params: IssueUpdateLabelsParams,
  options?: GiteaHttpOptions,
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}/labels`;
  const res = await giteaHttp.putJson<Label[]>(url, {
    ...options,
    body: params,
  });

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
  const res = await giteaHttp.getJson<Issue[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function getIssue(
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions,
): Promise<Issue> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${idx}`;
  const res = await giteaHttp.getJson<Issue>(url, options);
  return res.body;
}

export async function getRepoLabels(
  repoPath: string,
  options?: GiteaHttpOptions,
): Promise<Label[]> {
  const url = `${API_PATH}/repos/${repoPath}/labels`;
  const res = await giteaHttp.getJson<Label[]>(url, options);

  return res.body;
}

export async function getOrgLabels(
  orgName: string,
  options?: GiteaHttpOptions,
): Promise<Label[]> {
  const url = `${API_PATH}/orgs/${orgName}/labels`;
  const res = await giteaHttp.getJson<Label[]>(url, options);

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
  const res = await giteaHttp.postJson<Comment>(url, {
    ...options,
    body: params,
  });

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
  const res = await giteaHttp.patchJson<Comment>(url, {
    ...options,
    body: params,
  });

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
  options?: GiteaHttpOptions,
): Promise<Comment[]> {
  const url = `${API_PATH}/repos/${repoPath}/issues/${issue}/comments`;
  const res = await giteaHttp.getJson<Comment[]>(url, options);

  return res.body;
}

export async function createCommitStatus(
  repoPath: string,
  branchCommit: string,
  params: CommitStatusCreateParams,
  options?: GiteaHttpOptions,
): Promise<CommitStatus> {
  const url = `${API_PATH}/repos/${repoPath}/statuses/${branchCommit}`;
  const res = await giteaHttp.postJson<CommitStatus>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export const giteaToRenovateStatusMapping: Record<
  CommitStatusType,
  BranchStatus | null
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
    if (
      !ret[i.context] ||
      new Date(ret[i.context].created_at) < new Date(i.created_at)
    ) {
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
  const res = await giteaHttp.getJson<CommitStatus[]>(url, {
    ...options,
    paginate: true,
  });

  let worstState = 0;
  for (const cs of filterStatus(res.body)) {
    worstState = Math.max(worstState, commitStatusStates.indexOf(cs.status));
  }

  return {
    worstStatus: commitStatusStates[worstState],
    statuses: res.body,
  };
}

export async function getBranch(
  repoPath: string,
  branchName: string,
  options?: GiteaHttpOptions,
): Promise<Branch> {
  const url = `${API_PATH}/repos/${repoPath}/branches/${urlEscape(branchName)}`;
  const res = await giteaHttp.getJson<Branch>(url, options);

  return res.body;
}
