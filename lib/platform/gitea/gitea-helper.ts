import { BranchStatus, PrState } from '../../types';
import { GiteaHttp, GiteaHttpOptions } from '../../util/http/gitea';
import { getQueryString } from '../../util/url';
import { PrReviewersParams } from './types';

const giteaHttp = new GiteaHttp();

export type PRState = PrState.Open | PrState.Closed | PrState.All;
export type IssueState = 'open' | 'closed' | 'all';
export type CommitStatusType =
  | 'pending'
  | 'success'
  | 'error'
  | 'failure'
  | 'warning'
  | 'unknown';
export type PRMergeMethod = 'merge' | 'rebase' | 'rebase-merge' | 'squash';

export interface PR {
  number: number;
  state: PRState;
  title: string;
  body: string;
  mergeable: boolean;
  created_at: string;
  closed_at: string;
  diff_url: string;
  base?: {
    ref: string;
  };
  head?: {
    label: string;
    sha: string;
    repo?: Repo;
  };
  assignee?: {
    login?: string;
  };
  assignees?: any[];
  user?: { username?: string };
}

export interface Issue {
  number: number;
  state: IssueState;
  title: string;
  body: string;
  assignees: User[];
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  username: string;
}

export interface Repo {
  allow_merge_commits: boolean;
  allow_rebase: boolean;
  allow_rebase_explicit: boolean;
  allow_squash_merge: boolean;
  archived: boolean;
  clone_url: string;
  default_branch: string;
  empty: boolean;
  fork: boolean;
  full_name: string;
  mirror: boolean;
  owner: User;
  permissions: RepoPermission;
}

export interface RepoPermission {
  admin: boolean;
  pull: boolean;
  push: boolean;
}

export interface RepoSearchResults {
  ok: boolean;
  data: Repo[];
}

export interface RepoContents {
  path: string;
  content?: string;
  contentString?: string;
}

export interface Comment {
  id: number;
  body: string;
}

export interface Label {
  id: number;
  name: string;
  description: string;
  color: string;
}

export interface Branch {
  name: string;
  commit: Commit;
}

export interface Commit {
  id: string;
  author: CommitUser;
}

export interface CommitUser {
  name: string;
  email: string;
  username: string;
}

export interface CommitStatus {
  id: number;
  status: CommitStatusType;
  context: string;
  description: string;
  target_url: string;
  created_at: string;
}

export interface CombinedCommitStatus {
  worstStatus: CommitStatusType;
  statuses: CommitStatus[];
}

export type RepoSearchParams = {
  uid?: number;
  archived?: boolean;
};

export type IssueCreateParams = IssueUpdateParams;

export type IssueUpdateParams = {
  title?: string;
  body?: string;
  state?: IssueState;
  assignees?: string[];
};

export type IssueSearchParams = {
  state?: IssueState;
};

export type PRCreateParams = {
  base?: string;
  head?: string;
} & PRUpdateParams;

export type PRUpdateParams = {
  title?: string;
  body?: string;
  assignees?: string[];
  labels?: number[];
  state?: PRState;
};

export type PRSearchParams = {
  state?: PRState;
  labels?: number[];
};

export type PRMergeParams = {
  Do: PRMergeMethod;
};

export type CommentCreateParams = CommentUpdateParams;

export type CommentUpdateParams = {
  body: string;
};

export type CommitStatusCreateParams = {
  context?: string;
  description?: string;
  state?: CommitStatusType;
  target_url?: string;
};

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
  options?: GiteaHttpOptions
): Promise<User> {
  const url = 'user';
  const res = await giteaHttp.getJson<User>(url, options);
  return res.body;
}

export async function getVersion(options?: GiteaHttpOptions): Promise<string> {
  const url = 'version';
  const res = await giteaHttp.getJson<{ version: string }>(url, options);
  return res.body.version;
}

export async function searchRepos(
  params: RepoSearchParams,
  options?: GiteaHttpOptions
): Promise<Repo[]> {
  const query = getQueryString(params);
  const url = `repos/search?${query}`;
  const res = await giteaHttp.getJson<RepoSearchResults>(url, {
    ...options,
    paginate: true,
  });

  if (!res.body.ok) {
    throw new Error(
      'Unable to search for repositories, ok flag has not been set'
    );
  }

  return res.body.data;
}

export async function getRepo(
  repoPath: string,
  options?: GiteaHttpOptions
): Promise<Repo> {
  const url = `repos/${repoPath}`;
  const res = await giteaHttp.getJson<Repo>(url, options);
  return res.body;
}

export async function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string,
  options?: GiteaHttpOptions
): Promise<RepoContents> {
  const query = getQueryString(ref ? { ref } : {});
  const url = `repos/${repoPath}/contents/${urlEscape(filePath)}?${query}`;
  const res = await giteaHttp.getJson<RepoContents>(url, options);

  if (res.body.content) {
    res.body.contentString = Buffer.from(res.body.content, 'base64').toString();
  }

  return res.body;
}

export async function createPR(
  repoPath: string,
  params: PRCreateParams,
  options?: GiteaHttpOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls`;
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
  options?: GiteaHttpOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.patchJson<PR>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function closePR(
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions
): Promise<void> {
  await updatePR(repoPath, idx, {
    ...options,
    state: PrState.Closed,
  });
}

export async function mergePR(
  repoPath: string,
  idx: number,
  method: PRMergeMethod,
  options?: GiteaHttpOptions
): Promise<void> {
  const params: PRMergeParams = { Do: method };
  const url = `repos/${repoPath}/pulls/${idx}/merge`;
  await giteaHttp.postJson(url, {
    ...options,
    body: params,
  });
}

export async function getPR(
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls/${idx}`;
  const res = await giteaHttp.getJson<PR>(url, options);
  return res.body;
}

export async function requestPrReviewers(
  repoPath: string,
  idx: number,
  params: PrReviewersParams,
  options?: GiteaHttpOptions
): Promise<void> {
  const url = `repos/${repoPath}/pulls/${idx}/requested_reviewers`;
  await giteaHttp.postJson(url, {
    ...options,
    body: params,
  });
}

export async function searchPRs(
  repoPath: string,
  params: PRSearchParams,
  options?: GiteaHttpOptions
): Promise<PR[]> {
  const query = getQueryString(params);
  const url = `repos/${repoPath}/pulls?${query}`;
  const res = await giteaHttp.getJson<PR[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function createIssue(
  repoPath: string,
  params: IssueCreateParams,
  options?: GiteaHttpOptions
): Promise<Issue> {
  const url = `repos/${repoPath}/issues`;
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
  options?: GiteaHttpOptions
): Promise<Issue> {
  const url = `repos/${repoPath}/issues/${idx}`;
  const res = await giteaHttp.patchJson<Issue>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function closeIssue(
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions
): Promise<void> {
  await updateIssue(repoPath, idx, {
    ...options,
    state: 'closed',
  });
}

export async function searchIssues(
  repoPath: string,
  params: IssueSearchParams,
  options?: GiteaHttpOptions
): Promise<Issue[]> {
  const query = getQueryString({ ...params, type: 'issues' });
  const url = `repos/${repoPath}/issues?${query}`;
  const res = await giteaHttp.getJson<Issue[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function getRepoLabels(
  repoPath: string,
  options?: GiteaHttpOptions
): Promise<Label[]> {
  const url = `repos/${repoPath}/labels`;
  const res = await giteaHttp.getJson<Label[]>(url, options);

  return res.body;
}

export async function getOrgLabels(
  orgName: string,
  options?: GiteaHttpOptions
): Promise<Label[]> {
  const url = `orgs/${orgName}/labels`;
  const res = await giteaHttp.getJson<Label[]>(url, options);

  return res.body;
}

export async function unassignLabel(
  repoPath: string,
  issue: number,
  label: number,
  options?: GiteaHttpOptions
): Promise<void> {
  const url = `repos/${repoPath}/issues/${issue}/labels/${label}`;
  await giteaHttp.deleteJson(url, options);
}

export async function createComment(
  repoPath: string,
  issue: number,
  body: string,
  options?: GiteaHttpOptions
): Promise<Comment> {
  const params: CommentCreateParams = { body };
  const url = `repos/${repoPath}/issues/${issue}/comments`;
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
  options?: GiteaHttpOptions
): Promise<Comment> {
  const params: CommentUpdateParams = { body };
  const url = `repos/${repoPath}/issues/comments/${idx}`;
  const res = await giteaHttp.patchJson<Comment>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function deleteComment(
  repoPath: string,
  idx: number,
  options?: GiteaHttpOptions
): Promise<void> {
  const url = `repos/${repoPath}/issues/comments/${idx}`;
  await giteaHttp.deleteJson(url, options);
}

export async function getComments(
  repoPath: string,
  issue: number,
  options?: GiteaHttpOptions
): Promise<Comment[]> {
  const url = `repos/${repoPath}/issues/${issue}/comments`;
  const res = await giteaHttp.getJson<Comment[]>(url, options);

  return res.body;
}

export async function createCommitStatus(
  repoPath: string,
  branchCommit: string,
  params: CommitStatusCreateParams,
  options?: GiteaHttpOptions
): Promise<CommitStatus> {
  const url = `repos/${repoPath}/statuses/${branchCommit}`;
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
  unknown: BranchStatus.yellow,
  success: BranchStatus.green,
  pending: BranchStatus.yellow,
  warning: BranchStatus.red,
  failure: BranchStatus.red,
  error: BranchStatus.red,
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
  options?: GiteaHttpOptions
): Promise<CombinedCommitStatus> {
  const url = `repos/${repoPath}/commits/${urlEscape(branchName)}/statuses`;
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
  options?: GiteaHttpOptions
): Promise<Branch> {
  const url = `repos/${repoPath}/branches/${urlEscape(branchName)}`;
  const res = await giteaHttp.getJson<Branch>(url, options);

  return res.body;
}
