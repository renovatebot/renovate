import { execSync } from 'node:child_process';
import { glob } from 'glob';
import { logger } from '../../../logger';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import type { PlatformScm } from '../types';

let fileList: string[] | undefined;
export class LocalFs implements PlatformScm {
  isBranchBehindBase(branchName: string, baseBranch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchModified(branchName: string, baseBranch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchConflicted(baseBranch: string, branch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(true);
  }
  getBranchCommit(branchName: string): Promise<LongCommitSha | null> {
    return Promise.resolve(null);
  }
  deleteBranch(branchName: string): Promise<void> {
    return Promise.resolve();
  }
  commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    return Promise.resolve(null);
  }

  async getFileList(): Promise<string[]> {
    try {
      // fetch file list using git
      const maxBuffer = 10 * 1024 * 1024; // 10 MiB in bytes
      const stdout = execSync('git ls-files', { encoding: 'utf-8', maxBuffer });
      logger.debug('Got file list using git');
      fileList = stdout.split('\n');
    } catch {
      logger.debug('Could not get file list using git, using glob instead');
      fileList ??= await glob('**', {
        dot: true,
        nodir: true,
      });
    }

    return fileList;
  }

  checkoutBranch(branchName: string): Promise<LongCommitSha> {
    // We don't care about the commit sha in local mode
    return Promise.resolve('' as LongCommitSha);
  }

  mergeAndPush(branchName: string): Promise<void> {
    return Promise.resolve();
  }

  mergeToLocal(branchName: string): Promise<void> {
    return Promise.resolve();
  }
}
