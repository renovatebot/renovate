import { URLSearchParams } from 'url';
import { api, GiteaApiOptions } from './gitea-got-wrapper';
import { GotResponse } from '../common';

export type PRState = 'open' | 'closed' | 'all';
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
    ref: string;
    sha: string;
    repo?: Repo;
  };
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
}

export interface CombinedCommitStatus {
  worstStatus: CommitStatusType;
  statuses: CommitStatus[];
}

export type RepoSearchParams = {
  uid?: number;
};

export type IssueCreateParams = {} & IssueUpdateParams;

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

export type CommentCreateParams = {} & CommentUpdateParams;

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

function queryParams(params: Record<string, any>): URLSearchParams {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        usp.append(k, item.toString());
      }
    } else {
      usp.append(k, v.toString());
    }
  }
  return usp;
}

export async function getCurrentUser(options?: GiteaApiOptions): Promise<User> {
  const url = 'user';
  const res = await api.get<User>(url, options);

  return res.body;
}

export async function searchRepos(
  params: RepoSearchParams,
  options?: GiteaApiOptions
): Promise<Repo[]> {
  const query = queryParams(params).toString();
  const url = `repos/search?${query}`;
  const res = await api.get<RepoSearchResults>(url, {
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
  options?: GiteaApiOptions
): Promise<Repo> {
  const url = `repos/${repoPath}`;
  const res = await api.get<Repo>(url, options);

  return res.body;
}

export async function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string,
  options?: GiteaApiOptions
): Promise<RepoContents> {
  const query = queryParams(ref ? { ref } : {}).toString();
  const url = `repos/${repoPath}/contents/${urlEscape(filePath)}?${query}`;
  const res = await api.get<RepoContents>(url, options);

  if (res.body.content) {
    res.body.contentString = Buffer.from(res.body.content, 'base64').toString();
  }

  return res.body;
}

export async function createPR(
  repoPath: string,
  params: PRCreateParams,
  options?: GiteaApiOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls`;
  const res: GotResponse<PR> = await api.post(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updatePR(
  repoPath: string,
  idx: number,
  params: PRUpdateParams,
  options?: GiteaApiOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls/${idx}`;
  const res: GotResponse<PR> = await api.patch(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function closePR(
  repoPath: string,
  idx: number,
  options?: GiteaApiOptions
): Promise<void> {
  await updatePR(
    repoPath,
    idx,
    {
      state: 'closed',
    },
    options
  );
}

export async function mergePR(
  repoPath: string,
  idx: number,
  method: PRMergeMethod,
  options?: GiteaApiOptions
): Promise<void> {
  const params: PRMergeParams = { Do: method };
  const url = `repos/${repoPath}/pulls/${idx}/merge`;
  await api.post(url, {
    ...options,
    body: params,
  });
}

export async function getPR(
  repoPath: string,
  idx: number,
  options?: GiteaApiOptions
): Promise<PR> {
  const url = `repos/${repoPath}/pulls/${idx}`;
  const res = await api.get<PR>(url, options);

  return res.body;
}

export async function searchPRs(
  repoPath: string,
  params: PRSearchParams,
  options?: GiteaApiOptions
): Promise<PR[]> {
  const query = queryParams(params).toString();
  const url = `repos/${repoPath}/pulls?${query}`;
  const res = await api.get<PR[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function createIssue(
  repoPath: string,
  params: IssueCreateParams,
  options?: GiteaApiOptions
): Promise<Issue> {
  const url = `repos/${repoPath}/issues`;
  const res = await api.post<Issue>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updateIssue(
  repoPath: string,
  idx: number,
  params: IssueUpdateParams,
  options?: GiteaApiOptions
): Promise<Issue> {
  const url = `repos/${repoPath}/issues/${idx}`;
  const res = await api.patch<Issue>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function closeIssue(
  repoPath: string,
  idx: number,
  options?: GiteaApiOptions
): Promise<void> {
  await updateIssue(
    repoPath,
    idx,
    {
      state: 'closed',
    },
    options
  );
}

export async function searchIssues(
  repoPath: string,
  params: IssueSearchParams,
  options?: GiteaApiOptions
): Promise<Issue[]> {
  const query = queryParams(params).toString();
  const url = `repos/${repoPath}/issues?${query}`;
  const res = await api.get<Issue[]>(url, {
    ...options,
    paginate: true,
  });

  return res.body;
}

export async function getRepoLabels(
  repoPath: string,
  options?: GiteaApiOptions
): Promise<Label[]> {
  const url = `repos/${repoPath}/labels`;
  const res = await api.get<Label[]>(url, options);

  return res.body;
}

export async function unassignLabel(
  repoPath: string,
  issue: number,
  label: number,
  options?: GiteaApiOptions
): Promise<void> {
  const url = `repos/${repoPath}/issues/${issue}/labels/${label}`;
  await api.delete(url, options);
}

export async function createComment(
  repoPath: string,
  issue: number,
  body: string,
  options?: GiteaApiOptions
): Promise<Comment> {
  const params: CommentCreateParams = { body };
  const url = `repos/${repoPath}/issues/${issue}/comments`;
  const res: GotResponse = await api.post<Comment>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function updateComment(
  repoPath: string,
  idx: number,
  body: string,
  options?: GiteaApiOptions
): Promise<Comment> {
  const params: CommentUpdateParams = { body };
  const url = `repos/${repoPath}/issues/comments/${idx}`;
  const res = await api.patch<Comment>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function deleteComment(
  repoPath,
  idx: number,
  options?: GiteaApiOptions
): Promise<void> {
  const url = `repos/${repoPath}/issues/comments/${idx}`;
  await api.delete(url, options);
}

export async function getComments(
  repoPath,
  issue: number,
  options?: GiteaApiOptions
): Promise<Comment[]> {
  const url = `repos/${repoPath}/issues/${issue}/comments`;
  const res = await api.get<Comment[]>(url, options);

  return res.body;
}

export async function createCommitStatus(
  repoPath: string,
  branchCommit: string,
  params: CommitStatusCreateParams,
  options?: GiteaApiOptions
): Promise<CommitStatus> {
  const url = `repos/${repoPath}/statuses/${branchCommit}`;
  const res = await api.post<CommitStatus>(url, {
    ...options,
    body: params,
  });

  return res.body;
}

export async function getCombinedCommitStatus(
  repoPath: string,
  branchName: string,
  options?: GiteaApiOptions
): Promise<CombinedCommitStatus> {
  const url = `repos/${repoPath}/commits/${urlEscape(branchName)}/statuses`;
  const res = await api.get<CommitStatus[]>(url, {
    ...options,
    paginate: true,
  });

  let worstState = 0;
  for (const cs of res.body) {
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
  options?: GiteaApiOptions
): Promise<Branch> {
  const url = `repos/${repoPath}/branches/${urlEscape(branchName)}`;
  const res = await api.get<Branch>(url, options);

  return res.body;
}
