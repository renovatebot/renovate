import type { Pr } from '../types';

export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface Config {
  defaultBranch: string;
  hasBitbucketIssuesEnabled: boolean;
  mergeMethod: string;
  owner: string;
  prList: Pr[];
  repository: string;
  ignorePrAuthor: boolean;
  is_private: boolean;
  repositoryUrl: string;
  hasJiraProjectLinked: boolean;
  jiraProjectKey: string;
  jiraCloudUrl: string;
}

export interface PagedResult<T = any> {
  page?: number;
  pagelen: number;
  size?: number;
  next?: string;
  values: T[];
}

export interface RepoInfo {
  isFork: boolean;
  owner: string;
  mainbranch: string;
  mergeMethod: string;
  has_issues: boolean;
  uuid: string;
}

export interface RepoBranchingModel {
  development: {
    name: string;
    branch?: {
      name: string;
    };
  };
}

export interface BranchResponse {
  target: {
    hash: string;
  };
}

export type BitbucketBranchState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS';
export interface BitbucketStatus {
  key: string;
  state: BitbucketBranchState;
}

export interface RepoInfoBody {
  parent?: any;
  owner: { username: string };
  mainbranch: { name: string };
  has_issues: boolean;
  uuid: string;
  full_name: string;
  is_private: boolean;
  links: {
    html: {
      href: string;
    };
  };
}

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
  full_name: string;
  is_private: boolean;
}

export interface PrResponse {
  id: number;
  title: string;
  state: string;
  links: {
    commits: {
      href: string;
    };
  };
  summary?: { raw: string };
  source: {
    branch: {
      name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  reviewers: Array<Account>;
  created_on: string;
}

export interface BranchResponse {
  target: {
    hash: string;
  };
}
export interface Account {
  display_name?: string;
  uuid: string;
  nickname?: string;
  account_status?: string;
}

export interface EffectiveReviewer {
  type: string;
  reviewer_type: string;
  user: Account;
}

export interface BitbucketIssue {
  id: number;
  title: string;
  content?: {
    raw: string;
  };
}
export interface BitbucketJiraProjectsResponse {
  values: BitbucketJiraProject[];
}

export interface BitbucketJiraProject {
  project: {
    id: number;
    cloudId: string;
    key: string;
    name: string;
    url: string;
    site: {
      cloudId: string;
      cloudName: string;
      cloudUrl: string;
    };
  };
}
