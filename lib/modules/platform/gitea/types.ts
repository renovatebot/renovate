import type { PrState } from '../../../types';

export interface PrReviewersParams {
  reviewers?: string[];
  team_reviewers?: string[];
}

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
  labels: Label[];
}

export interface User {
  id: number;
  email: string;
  full_name?: string;
  username: string;
}

export interface Repo {
  id: number;
  allow_merge_commits: boolean;
  allow_rebase: boolean;
  allow_rebase_explicit: boolean;
  allow_squash_merge: boolean;
  archived: boolean;
  clone_url?: string;
  ssh_url?: string;
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

export interface RepoSearchParams {
  uid?: number;
  archived?: boolean;
}

export type IssueCreateParams = Partial<IssueUpdateLabelsParams> &
  IssueUpdateParams;

export interface IssueUpdateParams {
  title?: string;
  body?: string;
  state?: IssueState;
  assignees?: string[];
}

export interface IssueUpdateLabelsParams {
  labels?: number[];
}

export interface IssueSearchParams {
  state?: IssueState;
}

export interface PRCreateParams extends PRUpdateParams {
  base?: string;
  head?: string;
}

export interface PRUpdateParams {
  title?: string;
  body?: string;
  assignees?: string[];
  labels?: number[];
  state?: PRState;
}

export interface PRSearchParams {
  state?: PRState;
  labels?: number[];
}

export interface PRMergeParams {
  Do: PRMergeMethod;
  merge_when_checks_succeed?: boolean;
}

export type CommentCreateParams = CommentUpdateParams;

export interface CommentUpdateParams {
  body: string;
}

export interface CommitStatusCreateParams {
  context?: string;
  description?: string;
  state?: CommitStatusType;
  target_url?: string;
}
