import { RenovateConfig } from '../config/common';
import {
  BranchStatus,
  VulnerabilityAlert as _VulnerabilityAlert,
} from '../types';

export type VulnerabilityAlert = _VulnerabilityAlert;

export interface PlatformConfig {
  endpoint: string;
  renovateUsername?: any;
  gitAuthor?: any;
}

export interface RepoConfig {
  defaultBranch: string;
  endpoint?: string;
  renovateUsername?: any;
  gitAuthor?: any;
  isFork: boolean;
}

export interface RepoParams {
  azureWorkItemId?: number; // shouldn't this be configurable within a renovate.json?
  bbUseDefaultReviewers?: boolean; // shouldn't this be configurable within a renovate.json?
  localDir: string;
  optimizeForDisabled: boolean;
  repository: string;
  endpoint?: string;
  forkMode?: string;
  forkToken?: string;
  includeForks?: boolean;
  renovateUsername?: string;
}

/**
 *
 */
export interface Pr {
  body?: string;
  branchName: string;
  canMerge?: boolean;
  canMergeReason?: string;
  createdAt?: string;
  displayNumber?: string;
  isConflicted?: boolean;
  isModified?: boolean;
  isStale?: boolean;
  labels?: string[];
  number?: number;
  reviewers?: string[];
  sha?: string;
  sourceRepo?: string;
  state: string;
  targetBranch?: string;
  title: string;
}

/**
 * TODO: Proper typing
 */
export interface Issue {
  body?: string;
  number?: number;
  state?: string;
  title?: string;
}
export type PlatformPrOptions = {
  azureAutoComplete?: boolean;
  statusCheckVerify?: boolean;
  gitLabAutomerge?: boolean;
};
export interface CreatePRConfig {
  branchName: string;
  prTitle: string;
  prBody: string;
  labels?: string[] | null;
  useDefaultBranch?: boolean;
  platformOptions?: PlatformPrOptions;
  draftPR?: boolean;
}
export interface EnsureIssueConfig {
  title: string;
  reuseTitle?: string;
  body: string;
  once?: boolean;
  shouldReOpen?: boolean;
}
export interface BranchStatusConfig {
  branchName: string;
  context: string;
  description: string;
  state: BranchStatus;
  url?: string;
}
export interface FindPRConfig {
  branchName: string;
  prTitle?: string | null;
  state?: 'open' | 'closed' | '!open' | 'all';
  refreshCache?: boolean;
}
export interface EnsureCommentConfig {
  number: number;
  topic: string;
  content: string;
}

export interface EnsureCommentRemovalConfigByTopic {
  number: number;
  topic: string;
}
export interface EnsureCommentRemovalConfigByContent {
  number: number;
  content: string;
}
export interface EnsureCommentRemovalConfig {
  number: number;
  content?: string;
  topic?: string;
}

export type EnsureIssueResult = 'updated' | 'created';

export interface Platform {
  findIssue(title: string): Promise<Issue | null>;
  getIssueList(): Promise<Issue[]>;
  getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]>;
  initRepo(config: RepoParams): Promise<RepoConfig>;
  getPrList(): Promise<Pr[]>;
  ensureIssueClosing(title: string): Promise<void>;
  ensureIssue(
    issueConfig: EnsureIssueConfig
  ): Promise<EnsureIssueResult | null>;
  getPrBody(prBody: string): string;
  updatePr(number: number, prTitle: string, prBody?: string): Promise<void>;
  mergePr(number: number, branchName: string): Promise<boolean>;
  addReviewers(number: number, reviewers: string[]): Promise<void>;
  addAssignees(number: number, assignees: string[]): Promise<void>;
  createPr(prConfig: CreatePRConfig): Promise<Pr>;
  getRepos(): Promise<string[]>;
  getRepoForceRebase(): Promise<boolean>;
  deleteLabel(number: number, label: string): Promise<void>;
  setBranchStatus(branchStatusConfig: BranchStatusConfig): Promise<void>;
  getBranchStatusCheck(
    branchName: string,
    context: string
  ): Promise<BranchStatus | null>;
  ensureCommentRemoval(
    ensureCommentRemoval:
      | EnsureCommentRemovalConfigByTopic
      | EnsureCommentRemovalConfigByContent
  ): Promise<void>;
  deleteBranch(branchName: string, closePr?: boolean): Promise<void>;
  ensureComment(ensureComment: EnsureCommentConfig): Promise<boolean>;
  setBaseBranch(baseBranch?: string): Promise<string>;
  getPr(number: number): Promise<Pr>;
  findPr(findPRConfig: FindPRConfig): Promise<Pr>;
  refreshPr?(number: number): Promise<void>;
  getBranchStatus(
    branchName: string,
    requiredStatusChecks?: string[] | null
  ): Promise<BranchStatus>;
  getBranchPr(branchName: string): Promise<Pr | null>;
  initPlatform(config: RenovateConfig): Promise<PlatformConfig>;
}
