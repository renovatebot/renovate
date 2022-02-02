import type { GitOptions } from '../../types/git';

export type { DiffResult, StatusResult } from 'simple-git';

export interface GitAuthor {
  name?: string;
  address?: string;
}

export type GitNoVerifyOption = 'commit' | 'push';

export type CommitSha = string;

export interface StorageConfig {
  currentBranch?: string;
  url: string;
  extraCloneOpts?: GitOptions;
  cloneSubmodules?: boolean;
  fullClone?: boolean;
}

export interface LocalConfig extends StorageConfig {
  additionalBranches: string[];
  currentBranch: string;
  currentBranchSha: string;
  branchCommits: Record<string, CommitSha>;
  branchIsModified: Record<string, boolean>;
  ignoredAuthors: string[];
  gitAuthorName?: string;
  gitAuthorEmail?: string;

  writeGitDone?: boolean;
}

export interface FileAddition {
  /**
   * Addition creates new file or modifies existing one
   */
  type: 'addition';

  /**
   * Relative file path
   */
  path: string;

  /**
   * File contents
   */
  contents: string | Buffer;

  /**
   * The executable bit
   */
  isExecutable?: boolean;
}

export interface FileDeletion {
  /**
   * Deletion removes the file
   */
  type: 'deletion';

  /**
   * Relative file path
   */
  path: string;
}

export type FileChange = FileAddition | FileDeletion;

export interface CommitFilesConfig {
  branchName: string;
  files: FileChange[];
  message: string;
  force?: boolean;
  platformCommit?: boolean;
}

export type BranchName = string;
export type TargetBranchName = BranchName;
export type SourceBranchName = BranchName;

export type GitConflictsCache = Record<TargetBranchName, TargetBranchConflicts>;

export interface TargetBranchConflicts {
  targetBranchSha: CommitSha;
  sourceBranches: Record<SourceBranchName, SourceBranchConflict>;
}

export interface SourceBranchConflict {
  sourceBranchSha: CommitSha;
  isConflicted: boolean;
}

export interface CommitResult {
  parentCommitSha: string;
  commitSha: string;
  files: FileChange[];
}

export interface TreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
}
