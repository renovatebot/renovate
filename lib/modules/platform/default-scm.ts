import type { DateTime } from 'luxon';
import * as git from '../../util/git/index.ts';
import type { CommitFilesConfig } from '../../util/git/types.ts';
import type { LongCommitSha } from '../../util/schema-utils/git.ts';
import type { PlatformScm, PreparedCommit } from './types.ts';

export class DefaultGitScm implements PlatformScm {
  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(git.branchExists(branchName));
  }

  async prepareCommit(
    commitConfig: CommitFilesConfig,
  ): Promise<PreparedCommit | null> {
    const commitResult = await git.prepareCommit(commitConfig);
    if (!commitResult) {
      return null;
    }
    return {
      sha: commitResult.commitSha,
      push: () => git.pushPreparedCommit(commitConfig, commitResult),
    };
  }

  async commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    const preparedCommit = await this.prepareCommit(commitConfig);
    if (!preparedCommit) {
      return null;
    }
    return await preparedCommit.push();
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

  getAllBranchUpdateDates(): Promise<Record<string, DateTime>> {
    return git.getAllBranchUpdateDates();
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
