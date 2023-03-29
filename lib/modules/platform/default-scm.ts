import * as git from '../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../util/git/types';
import type { PlatformScm } from './types';

export class DefaultGitScm implements PlatformScm {
  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(git.branchExists(branchName));
  }

  commitAndPush(commitConfig: CommitFilesConfig): Promise<CommitSha | null> {
    return git.commitFiles(commitConfig);
  }

  deleteBranch(branchName: string): Promise<void> {
    return git.deleteBranch(branchName);
  }

  getBranchCommit(branchName: string): Promise<CommitSha | null> {
    return Promise.resolve(git.getBranchCommit(branchName));
  }

  isBranchBehindBase(branchName: string, baseBranch: string): Promise<boolean> {
    return git.isBranchBehindBase(branchName, baseBranch);
  }

  isBranchConflicted(baseBranch: string, branch: string): Promise<boolean> {
    return git.isBranchConflicted(baseBranch, branch);
  }

  isBranchModified(branchName: string, baseBranch: string): Promise<boolean> {
    return git.isBranchModified(branchName, baseBranch);
  }
}
