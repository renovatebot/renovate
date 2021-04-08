import type { BranchStatus, PrState, VulnerabilityAlert } from '../types';

type VulnerabilityKey = string;
type VulnerabilityRangeKey = string;
type VulnerabilityPatch = string;
export type AggregatedVulnerabilities = Record<
  VulnerabilityKey,
  Record<VulnerabilityRangeKey, VulnerabilityPatch>
>;

export interface PlatformParams {
  endpoint?: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface PlatformResult {
  endpoint: string;
  renovateUsername?: any;
  gitAuthor?: any;
}

export interface RepoResult {
  defaultBranch: string;
  isFork: boolean;
}

export interface RepoParams {
  localDir: string;
  repository: string;
  endpoint?: string;
  forkMode?: string;
  forkToken?: string;
  includeForks?: boolean;
  renovateUsername?: string;
  cloneSubmodules?: boolean;
  ignorePrAuthor?: boolean;
}

/**
 *
 */
export interface Pr {
  body?: string;
  sourceBranch: string;
  canMerge?: boolean;
  canMergeReason?: string;
  createdAt?: string;
  closedAt?: string;
  displayNumber?: string;
  hasAssignees?: boolean;
  hasReviewers?: boolean;
  isConflicted?: boolean;
  labels?: string[];
  number?: number;
  reviewers?: string[];
  sha?: string;
  sourceRepo?: string;
  state: string;
  targetBranch?: string;
  title: string;
  isDraft?: boolean;
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
  azureWorkItemId?: number;
  bbUseDefaultReviewers?: boolean;
  gitLabAutomerge?: boolean;
};
export interface CreatePRConfig {
  sourceBranch: string;
  targetBranch: string;
  prTitle: string;
  prBody: string;
  labels?: string[] | null;
  platformOptions?: PlatformPrOptions;
  draftPR?: boolean;
}
export interface UpdatePrConfig {
  number: number;
  platformOptions?: PlatformPrOptions;
  prTitle: string;
  prBody?: string;
  state?: PrState.Open | PrState.Closed;
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
  state?: PrState.Open | PrState.Closed | PrState.NotOpen | PrState.All;
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
  getRawFile(fileName: string, repo?: string): Promise<string | null>;
  getJsonFile(fileName: string, repo?: string): Promise<any | null>;
  initRepo(config: RepoParams): Promise<RepoResult>;
  getPrList(): Promise<Pr[]>;
  ensureIssueClosing(title: string): Promise<void>;
  ensureIssue(
    issueConfig: EnsureIssueConfig
  ): Promise<EnsureIssueResult | null>;
  massageMarkdown(prBody: string): string;
  updatePr(prConfig: UpdatePrConfig): Promise<void>;
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
  ensureComment(ensureComment: EnsureCommentConfig): Promise<boolean>;
  getPr(number: number): Promise<Pr>;
  findPr(findPRConfig: FindPRConfig): Promise<Pr>;
  refreshPr?(number: number): Promise<void>;
  getBranchStatus(
    branchName: string,
    requiredStatusChecks?: string[] | null
  ): Promise<BranchStatus>;
  getBranchPr(branchName: string): Promise<Pr | null>;
  initPlatform(config: PlatformParams): Promise<PlatformResult>;
}
