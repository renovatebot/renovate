import type { PlatformCommitOptions } from '../../config/types';
import type { GitOptions } from '../../types/git';
import type { EmailAddress } from '../schema-utils';

export type { DiffResult, StatusResult } from 'simple-git';

export interface GitAuthor {
  name?: string | null;
  address?: string;
}

export type GitNoVerifyOption = 'commit' | 'push';

/**
 * We want to make sure this is a long sha of 40 characters and not just any string
 */
export type LongCommitSha = string & { __longCommitSha: never };

export interface StorageConfig {
  currentBranch?: string;
  defaultBranch?: string;
  url: string;
  upstreamUrl?: string | undefined;
  extraCloneOpts?: GitOptions;
  cloneSubmodules?: boolean;
  cloneSubmodulesFilter?: string[];
  fullClone?: boolean;
}

export interface LocalConfig extends StorageConfig {
  additionalBranches: string[];
  currentBranch: string;
  currentBranchSha: LongCommitSha;
  branchCommits: Record<string, LongCommitSha>;
  branchIsModified: Record<string, boolean>;
  commitBranches: Record<string, string[]>;
  ignoredAuthors: string[];
  gitAuthorName?: string | null;
  gitAuthorEmail?: EmailAddress;

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
  platformCommit?: PlatformCommitOptions;
  /** Only needed by Gerrit platform */
  prTitle?: string;
  /** Only needed by Gerrit platform */
  autoApprove?: boolean;
  /** Only needed by Gerrit platform */
  labels?: string[];
}

export interface PushFilesConfig {
  sourceRef: string;
  targetRef?: string;
  files: FileChange[];
  pushOptions?: string[];
}

export type BranchName = string;

export interface CommitResult {
  parentCommitSha: LongCommitSha;
  commitSha: LongCommitSha;
  files: FileChange[];
}

export interface TreeItem {
  path: string;
  mode: string;
  type: string;
  sha: LongCommitSha;
}

/**
 * Represents a git authentication rule in the form of e.g.:
 * git config --global url."https://api@github.com/".insteadOf "https://github.com/"
 */
export interface AuthenticationRule {
  url: string;
  insteadOf: string;
}

export type GitOperationType =
  /**
   * The `git clone` sub-command.
   */
  | 'clone'
  /**
   * The `git reset` sub-command.
   */
  | 'reset'
  /**
   * The `git checkout` sub-command.
   */
  | 'checkout'
  /**
   * The `git fetch` sub-command.
   */
  | 'fetch'
  /**
   * The `git pull` sub-command.
   */
  | 'pull'
  /**
   * The `git push` sub-command.
   */
  | 'push'
  /**
   * The `git clean` sub-command.
   */
  | 'clean'
  /**
   * The `git merge` sub-command.
   */
  | 'merge'
  /**
   * The `git submodule` sub-command.
   */
  | 'submodule'
  /**
   * The `git commit` sub-command.
   */
  | 'commit'
  /**
   * The `git branch` sub-command.
   */
  | 'branch'
  /**
   * Any internal "plumbing" commands
   *
   * - `git update-index`
   *
   * See also: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
   */
  | 'plumbing'
  /**
   * Any other operations i.e.
   *
   * - `git add`
   * - `git branch`
   * - `git config`
   * - `git diff`
   * - `git log`
   * - `git ls-remote`
   * - `git remote`
   * - `git rev-parse`
   * - `git status`
   *
   * See also: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
   */
  | 'other';
