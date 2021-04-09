import { Pr } from '../types';

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

export interface GhPr extends Pr {
  comments: Comment[];
  mergeable: boolean;
}

export interface GhRestPr extends GhPr {
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
}

export interface GhGraphQlPr extends GhPr {
  commits: any;
  reviewRequests: any;
  assignees: any;
  mergeStateStatus: string;
  reviews: any;
  baseRefName: string;
  headRefName: string;
  comments: Comment[] & { nodes?: { databaseId: number; body: string }[] };
  labels: string[] & { nodes?: { name: string }[] };
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
  prList: GhPr[] | null;
  issueList: any[] | null;
  mergeMethod: string;
  defaultBranch: string;
  repositoryOwner: string;
  repository: string | null;
  localDir: string;
  isGhe: boolean;
  renovateUsername: string;
  productLinks: any;
  ignorePrAuthor: boolean;
  branchPrs: Pr[];
}

export type BranchProtection = any;
export type PrList = Record<number, GhPr>;

export interface GhRepo {
  isFork: boolean;
  isArchived: boolean;
  nameWithOwner: string;
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
