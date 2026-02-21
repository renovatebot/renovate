import type { DateTime } from 'luxon';
import * as git from '../../util/git/index.ts';
import type { CommitFilesConfig, LongCommitSha } from '../../util/git/types.ts';
import type { PlatformScm } from './types.ts';

export class DefaultGitScm implements PlatformScm {
  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(git.branchExists(branchName));
  }

  commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    return git.commitFiles(commitConfig);
  }

  deleteBranch(branchName: string): Promise<void> {
    return git.deleteBranch(branchName);
  }

  getBranchCommit(branchName: string): Promise<LongCommitSha | null> {
    return Promise.resolve(git.getBranchCommit(branchName));
  }

  getBranchUpdateDate(branchName: string): Promise<DateTime | null> {
    return git.getBranchUpdateDate(branchName);
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

  getFileList(): Promise<string[]> {
    return git.getFileList();
  }

  checkoutBranch(branchName: string): Promise<LongCommitSha> {
    return git.checkoutBranch(branchName);
  }

  mergeAndPush(branchName: string): Promise<void> {
    return git.mergeBranch(branchName);
  }

  mergeToLocal(branchName: string): Promise<void> {
    return git.mergeToLocal(branchName);
  }

  syncForkWithUpstream(branchName: string): Promise<void> {
    return git.syncForkWithUpstream(branchName);
  }
}
