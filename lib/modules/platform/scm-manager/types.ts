export type Page<T> = {
  page: number;
  pageTotal: number;
  _embedded: T;
};

export interface Links {
  [link: string]: Link | Link[] | undefined;
}

export interface Link {
  href: string;
  name?: string;
  templated?: boolean;
}

export interface PullRequestPage {
  pullRequests: PullRequest[];
}

export interface PullRequestCreateParams extends PullRequestUpdateParams {
  source: string;
  target: string;
}

export interface PullRequestUpdateParams {
  title: string;
  description?: string;
  assignees?: string[];
  status?: PRState;
  target?: string;
}

export interface PullRequest {
  id: string;
  author?: User;
  reviser?: Reviser;
  closeDate?: string;
  source: string;
  target: string;
  title: string;
  description: string;
  creationDate: string;
  lastModified?: string;
  status: PRState;
  reviewer?: Reviewer[];
  labels: string[];
  tasks: Tasks;
  _links: Links;
  _embedded: {
    defaultConfig: {
      mergeStrategy: PRMergeMethod;
      deleteBranchOnMerge: boolean;
    };
  };
}

export interface User {
  mail?: string;
  displayName: string;
  username: string;
}

export interface Reviser {
  id?: string;
  displayName?: string;
}

export type PRState = 'DRAFT' | 'OPEN' | 'REJECTED' | 'MERGED';

export interface Reviewer {
  id: string;
  displayName: string;
  mail?: string;
  approved: boolean;
}

export interface Tasks {
  todo: number;
  done: number;
}

export type PRMergeMethod =
  | 'MERGE_COMMIT'
  | 'REBASE'
  | 'FAST_FORWARD_IF_POSSIBLE'
  | 'SQUASH';

export type CommitStatusType =
  | 'pending'
  | 'success'
  | 'error'
  | 'failure'
  | 'warning'
  | 'unknown';

export interface RepoPage {
  repositories: Repo[];
}

export interface Repo {
  contact: string;
  creationDate: string;
  description: string;
  lastModified?: string;
  namespace: string;
  name: string;
  type: RepoType;
  archived: boolean;
  exporting: boolean;
  healthCheckRunning: boolean;
  _links: Links;
}

export type RepoType = 'git' | 'svn' | 'hg';

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
  author: User;
}

export interface CommitStatus {
  id: number;
  description: string;
}

export type PrFilterByState = 'open' | 'closed' | '!open' | 'all';
