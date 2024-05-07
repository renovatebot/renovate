import type { LongCommitSha } from '../../../util/git/types';
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

export interface GhRestRepo {
  full_name: string;
  default_branch: string;
  owner: {
    login: string;
  };
  archived: boolean;
  topics: string[];
}

export interface GhRestPr {
  head: {
    ref: string;
    sha: LongCommitSha;
    repo: {
      full_name: string;
      pushed_at?: string;
    };
  };
  base: {
    repo: {
      pushed_at?: string;
    };
    ref: string;
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

export interface GhPr extends Pr {
  updated_at: string;
  node_id: string;
}

export interface UserDetails {
  username: string;
  name: string;
  id: number;
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
  branchForceRebase?: Record<string, boolean>;
  parentRepo: string | null;
  forkOrg?: string;
  forkToken?: string;
  forkCreation?: boolean;
  prList: GhPr[] | null;
  mergeMethod: 'rebase' | 'squash' | 'merge';
  defaultBranch: string;
  repositoryOwner: string;
  repository: string | null;
  renovateUsername: string | undefined;
  renovateForkUser: string | undefined;
  productLinks: any;
  ignorePrAuthor: boolean;
  autoMergeAllowed: boolean;
  hasIssuesEnabled: boolean;
  hasVulnerabilityAlertsEnabled: boolean;
}

export type BranchProtection = any;

export interface GhRepo {
  id: string;
  isFork: boolean;
  parent?: {
    nameWithOwner: string;
  };
  isArchived: boolean;
  nameWithOwner: string;
  autoMergeAllowed: boolean;
  hasIssuesEnabled: boolean;
  hasVulnerabilityAlertsEnabled: boolean;
  mergeCommitAllowed: boolean;
  rebaseMergeAllowed: boolean;
  squashMergeAllowed: boolean;
  defaultBranchRef: {
    name: string;
    target: {
      oid: string;
    };
  };
  issues: { nodes: unknown[] };
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
}
