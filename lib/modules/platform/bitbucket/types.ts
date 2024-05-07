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
  reviewers: Account[];
  created_on: string;
  updated_on: string;
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

export interface BitbucketPrCacheData {
  items: Record<number, Pr>;
  updated_on: string | null;
  author: string | null;
}
