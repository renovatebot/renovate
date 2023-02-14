import * as _git from '../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../util/git/types';
import type { PlatformScm } from './types';

export class DefaultGitScm implements PlatformScm {
  public static instance: PlatformScm = new this();

  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(_git.branchExists(branchName));
  }

  commitAndPush(commitConfig: CommitFilesConfig): Promise<CommitSha | null> {
    return _git.commitFiles(commitConfig);
  }

  deleteBranch(branchName: string): Promise<void> {
    return _git.deleteBranch(branchName);
  }

  getBranchCommit(branchName: string): Promise<CommitSha | null> {
    return Promise.resolve(_git.getBranchCommit(branchName));
  }

  isBranchBehindBase(branchName: string, baseBranch: string): Promise<boolean> {
    return _git.isBranchBehindBase(branchName, baseBranch);
  }

  isBranchConflicted(baseBranch: string, branch: string): Promise<boolean> {
    return _git.isBranchConflicted(baseBranch, branch);
  }

  isBranchModified(branchName: string): Promise<boolean> {
    return _git.isBranchModified(branchName);
  }
}
