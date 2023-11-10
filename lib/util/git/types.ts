import type { GitOptions } from '../../types/git';

export type { DiffResult, StatusResult } from 'simple-git';

export interface GitAuthor {
  name?: string | null;
  address?: string;
}

export type GitNoVerifyOption = 'commit' | 'push';

export type LongCommitSha = string;

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
  branchCommits: Record<string, LongCommitSha>;
  branchIsModified: Record<string, boolean>;
  commitBranches: Record<string, string[]>;
  ignoredAuthors: string[];
  gitAuthorName?: string | null;
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
  contents: string | Buffer | null;

  /**
   * The executable bit
   */
  isExecutable?: boolean;

  isSymlink?: boolean;
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
  baseBranch?: string;
  branchName: string;
  files: FileChange[];
  message: string | string[];
  force?: boolean;
  platformCommit?: boolean;
}

export interface PushFilesConfig {
  sourceRef: string;
  targetRef?: string;
  files: FileChange[];
}

export type BranchName = string;

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

/**
 * Represents a git authentication rule in the form of e.g.:
 * git config --global url."https://api@github.com/".insteadOf "https://github.com/"
 */
export interface AuthenticationRule {
  url: string;
  insteadOf: string;
}
