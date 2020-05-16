import got from 'got';
import Git from 'simple-git/promise';
import { RenovateConfig } from '../config/common';
import {
  BranchStatus,
  VulnerabilityAlert as _VulnerabilityAlert,
} from '../types';

export type VulnerabilityAlert = _VulnerabilityAlert;

/**
 * File to commit to branch
 */
export interface File {
  /**
   * Relative file path
   */
  name: string;

  /**
   * file contents
   */
  contents: string | Buffer;
}

export type CommitFilesConfig = {
  branchName: string;
  files: File[];
  message: string;
};

export interface GotApiOptions {
  useCache?: boolean;
  hostType?: string;
  body?: any;
}

export type GotResponse<T extends object = any> = got.Response<T>;

export interface GotApi<TOptions extends object = any> {
  get<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  post<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  put<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  patch<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  head<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  delete<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;

  reset(): void;

  setBaseUrl(endpoint: string): void;
}

export interface PlatformConfig {
  endpoint: string;
  renovateUsername?: any;
  gitAuthor?: any;
}

export interface RepoConfig {
  baseBranch: string;
  endpoint?: string;
  renovateUsername?: any;
  gitAuthor?: any;
  isFork: boolean;
}

export interface RepoParams {
  azureWorkItemId?: number; // shouldn't this be configurable within a renovate.json?
  bbUseDefaultReviewers?: boolean; // shouldn't this be configurable within a renovate.json?
  gitPrivateKey?: string;
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
}
export interface EnsureIssueConfig {
  title: string;
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
  getCommitMessages(): Promise<string[]>;
  setBranchPrefix(branchPrefix: string): Promise<void>;
  initRepo(config: RepoParams): Promise<RepoConfig>;
  cleanRepo(): Promise<void>;
  getPrList(): Promise<Pr[]>;
  getAllRenovateBranches(branchPrefix: string): Promise<string[]>;
  ensureIssueClosing(title: string): Promise<void>;
  getFileList(): Promise<string[]>;
  ensureIssue(
    issueConfig: EnsureIssueConfig
  ): Promise<EnsureIssueResult | null>;
  getPrBody(prBody: string): string;
  updatePr(number: number, prTitle: string, prBody?: string): Promise<void>;
  mergePr(number: number, branchName: string): Promise<boolean>;
  addReviewers(number: number, reviewers: string[]): Promise<void>;
  addAssignees(number: number, assignees: string[]): Promise<void>;
  createPr(prConfig: CreatePRConfig): Promise<Pr>;
  getBranchLastCommitTime(branchName: string): Promise<Date>;
  getRepos(): Promise<string[]>;
  isBranchStale(branchName: string): Promise<boolean>;
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
  branchExists(branchName: string): Promise<boolean>;
  setBaseBranch(baseBranch?: string): Promise<string>;
  commitFiles(commitFile: CommitFilesConfig): Promise<string | null>;
  getPr(number: number): Promise<Pr>;
  findPr(findPRConfig: FindPRConfig): Promise<Pr>;
  mergeBranch(branchName: string): Promise<void>;
  getBranchStatus(
    branchName: string,
    requiredStatusChecks?: string[] | null
  ): Promise<BranchStatus>;
  getBranchPr(branchName: string): Promise<Pr | null>;
  getRepoStatus(): Promise<Git.StatusResult>;
  getFile(lockFileName: string, branchName?: string): Promise<string>;
  initPlatform(config: RenovateConfig): Promise<PlatformConfig>;
}
