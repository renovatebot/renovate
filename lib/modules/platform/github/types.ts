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

export interface GhRestPr extends Pr {
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
}

export interface GhGraphQlPr extends Pr {
  reviewRequests: any;
  assignees: any;
  mergeStateStatus: string;
  reviews: any;
  baseRefName: string;
  headRefName: string;
  comments: Comment[] & { nodes?: { databaseId: number; body: string }[] };
  labels: string[] & { nodes?: { name: string }[] };
}

export interface PlatformConfig {
  hostType: string;
  endpoint: string;
  isGhe?: boolean;
  gheVersion?: string | null;
  isGHApp?: boolean;
}

export interface LocalRepoConfig {
  repositoryName: string;
  pushProtection: boolean;
  prReviewsRequired: boolean;
  repoForceRebase?: boolean;
  parentRepo: string;
  forkMode?: boolean;
  forkToken?: string;
  closedPrList: PrMap | null;
  openPrList: PrMap | null;
  prList: Pr[] | null;
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
export type PrMap = Pr[];

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
