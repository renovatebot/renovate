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

export type File = FileAddition | FileDeletion;

export interface CommitFilesConfig {
  branchName: string;
  files: File[];
  message: string;
  force?: boolean;
}

export interface PushFilesConfig {
  message: string;
  branchName: string;
  files: File[];
}
