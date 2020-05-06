import { Pr } from '../common';
import GitStorage from '../git/storage';

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
  storage: GitStorage;
  parentRepo: string;
  baseCommitSHA: string | null;
  forkMode?: boolean;
  forkToken?: string;
  closedPrList: PrList | null;
  openPrList: PrList | null;
  prList: GhPr[] | null;
  issueList: any[] | null;
  mergeMethod: string;
  baseBranch: string;
  defaultBranch: string;
  enterpriseVersion: string;
  gitPrivateKey?: string;
  repositoryOwner: string;
  repository: string | null;
  localDir: string;
  isGhe: boolean;
  renovateUsername: string;
  productLinks: any;
}

export type BranchProtection = any;
export type PrList = Record<number, GhPr>;
