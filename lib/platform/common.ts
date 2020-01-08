import got from 'got';
import Git from 'simple-git/promise';
import { RenovateConfig } from '../config/common';
import { CommitFilesConfig } from './git/storage';

export interface FileData {
  name: string;
  contents: string;
}

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
 * TODO: Proper typing
 */
export type Pr = {
  branchName: string;
  title: string;
  state: string;
  isConflicted?: boolean;
  isModified?: boolean;
} & Record<string, any>;

/**
 * TODO: Proper typing
 */
export interface Issue {
  body?: string;
  number?: number;
  state?: string;
  title?: string;
}

export type BranchStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'running'
  | 'failure';

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
  state: string | null;
  url?: string;
}
/**
 * TODO: Proper typing
 */
export type VulnerabilityAlert = any;

export interface Platform {
  findIssue(title: string): Promise<Issue>;
  getIssueList(): Promise<Issue[]>;
  getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]>;
  getCommitMessages(): Promise<string[]>;
  setBranchPrefix(branchPrefix: string): Promise<void>;
  initRepo(config: RepoParams): Promise<RepoConfig>;
  cleanRepo(): Promise<void>;
  getPrFiles(prNo: number): Promise<string[]>;
  getPrList(): Promise<Pr[]>;
  getAllRenovateBranches(branchPrefix: string): Promise<string[]>;
  ensureIssueClosing(title: string): Promise<void>;
  getFileList(): Promise<string[]>;
  ensureIssue(
    issueConfig: EnsureIssueConfig
  ): Promise<'updated' | 'created' | null>;
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
  getBranchStatusCheck(branchName: string, context: string): Promise<string>;
  ensureCommentRemoval(number: number, subject: string): Promise<void>;
  deleteBranch(branchName: string, closePr?: boolean): Promise<void>;
  ensureComment(
    number: number,
    subject: string,
    content: string
  ): Promise<boolean>;
  branchExists(branchName: string): Promise<boolean>;
  setBaseBranch(baseBranch: string): Promise<void>;
  commitFilesToBranch(commitFile: CommitFilesConfig): Promise<void>;
  getPr(number: number): Promise<Pr>;
  findPr(
    branchName: string,
    prTitle: string | null,
    state?: string
  ): Promise<Pr>;
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
