import type { Pr } from '../types';

export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
}

export interface Config {
  defaultBranch: string;
  has_issues: boolean;
  mergeMethod: string;
  owner: string;
  prList: Pr[];
  repository: string;
  ignorePrAuthor: boolean;
  is_private: boolean;
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
  is_private: boolean;
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
