import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import {
  branchExists,
  commitFiles,
  getBranchCommit,
  isBranchBehindBase,
  isBranchConflicted,
  isBranchModified,
} from './';

export class GerritScm extends DefaultGitScm {
  override branchExists(branchName: string): Promise<boolean> {
    return branchExists(branchName);
  }

  override commitAndPush(
    commitConfig: CommitFilesConfig
  ): Promise<CommitSha | null> {
    return commitFiles(commitConfig);
  }

  override deleteBranch(branchName: string): Promise<void> {
    return Promise.resolve();
  }

  override getBranchCommit(branchName: string): Promise<CommitSha | null> {
    return getBranchCommit(branchName);
  }

  override isBranchBehindBase(
    branchName: string,
    baseBranch: string
  ): Promise<boolean> {
    return isBranchBehindBase(branchName, baseBranch);
  }

  override isBranchConflicted(
    baseBranch: string,
    branch: string
  ): Promise<boolean> {
    return isBranchConflicted(baseBranch, branch);
  }

  override isBranchModified(branchName: string): Promise<boolean> {
    return isBranchModified(branchName);
  }
}
