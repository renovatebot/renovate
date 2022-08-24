import type { Pr, PrBodyStruct } from '../types';

// https://developer.github.com/v3/repos/statuses
// https://developer.github.com/v3/checks/runs/
export type CombinedBranchState = 'failure' | 'pending' | 'success';
export type BranchState = 'failure' | 'pending' | 'success' | 'error';

export interface GhBranchStatus {
  context: string;
  state: BranchState;
}

export interface CombinedBranchStatus {
  state: CombinedBranchState;
  statuses: GhBranchStatus[];
}

export interface Comment {
  id: number;
  body: string;
}

export interface GhRestPr {
  head: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
      pushed_at?: string;
    };
  };
  base: {
    repo: {
      pushed_at?: string;
    };
  };
  mergeable_state: string;
  number: number;
  title: string;
  body?: string;
  bodyStruct?: PrBodyStruct;
  state: string;
  merged_at?: string;
  created_at: string;
  closed_at?: string;
  updated_at: string;
  user?: { login?: string };
  node_id: string;
  assignee?: { login?: string };
  assignees?: { login?: string }[];
  requested_reviewers?: { login?: string }[];
  labels?: { name: string }[];
  _links?: unknown;
}

export interface GhGraphQlPr {
  number: number;
  title: string;
  body?: string;
  state?: string;
  headRefName: string;
  baseRefName?: string;
  labels?: { nodes?: { name: string }[] };
  assignees?: { totalCount: number };
  reviewRequests?: { totalCount: number };
  comments?: {
    nodes?: {
      databaseId: number;
      body: string;
    }[];
  };
}

export interface UserDetails {
  username: string;
  name: string;
}

export interface PlatformConfig {
  hostType: string;
  endpoint: string;
  isGhe?: boolean;
  gheVersion?: string | null;
  isGHApp?: boolean;
  existingRepos?: string[];
  userDetails?: UserDetails;
  userEmail?: string | null;
}

export interface LocalRepoConfig {
  repositoryName: string;
  pushProtection: boolean;
  prReviewsRequired: boolean;
  repoForceRebase?: boolean;
  parentRepo: string | null;
  forkMode?: boolean;
  forkToken?: string;
  prList: Pr[] | null;
  issueList: any[] | null;
  mergeMethod: 'rebase' | 'squash' | 'merge';
  defaultBranch: string;
  repositoryOwner: string;
  repository: string | null;
  renovateUsername: string | undefined;
  productLinks: any;
  ignorePrAuthor: boolean;
  autoMergeAllowed: boolean;
  hasIssuesEnabled: boolean;
}

export type BranchProtection = any;

export interface GhRepo {
  id: string;
  isFork: boolean;
  isArchived: boolean;
  nameWithOwner: string;
  autoMergeAllowed: boolean;
  hasIssuesEnabled: boolean;
  mergeCommitAllowed: boolean;
  rebaseMergeAllowed: boolean;
  squashMergeAllowed: boolean;
  defaultBranchRef: {
    name: string;
    target: {
      oid: string;
    };
  };
}

export interface GhAutomergeResponse {
  enablePullRequestAutoMerge: {
    pullRequest: { number: number };
  };
}

export interface ApiPageItem {
  number: number;
  updated_at: string;
}

/**
 * Mutable object designed to be used in the repository cache
 */
export interface ApiPageCache<T extends ApiPageItem = ApiPageItem> {
  items: Record<number, T>;
  lastModified?: string;
  etag?: string;
}
