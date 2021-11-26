import type {
  DiffResult as DiffResult_,
  StatusResult as StatusResult_,
} from 'simple-git';
import type { GitOptions } from '../../types/git';

export type StatusResult = StatusResult_;
export type DiffResult = DiffResult_;

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

/**
 * File to commit
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

  /**
   * the executable bit
   */
  executable?: boolean;
}

export type CommitFilesConfig = {
  branchName: string;
  files: File[];
  message: string;
  force?: boolean;
};
