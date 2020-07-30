import { Pr } from '../common';

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
