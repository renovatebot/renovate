import type { Pr } from '../types';

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
    repo: { full_name: string };
  };
  mergeable_state: string;
  number: number;
  title: string;
  state: string;
  merged_at: string;
  created_at: string;
  closed_at: string;
  user?: { login?: string };
  node_id: string;
  assignee?: { login?: string };
  assignees?: { login?: string }[];
  requested_reviewers?: { login?: string }[];
  labels?: { name: string }[];
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
  parentRepo: string;
  forkMode?: boolean;
  forkToken?: string;
  closedPrList: PrList | null;
  openPrList: PrList | null;
  prList: Pr[] | null;
  prComments: Record<number, Comment[]>;
  issueList: any[] | null;
  mergeMethod: 'rebase' | 'squash' | 'merge';
  defaultBranch: string;
  repositoryOwner: string;
  repository: string | null;
  renovateUsername: string;
  productLinks: any;
  ignorePrAuthor: boolean;
  branchPrs: Pr[];
  autoMergeAllowed: boolean;
  hasIssuesEnabled: boolean;
}

export type BranchProtection = any;
export type PrList = Record<number, Pr>;

export interface GhRepo {
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

export interface RestPageItem {
  number: number;
  updated_at: string;
}

/**
 * Mutable object designed to be used in the repository cache
 */
export interface RestPageCache<T extends RestPageItem = RestPageItem> {
  items: Record<number, T>;
  timestamp: string;
  etag: string;
}
