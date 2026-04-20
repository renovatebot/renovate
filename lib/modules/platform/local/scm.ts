import { glob } from 'glob';
import type { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { rawExec } from '../../../util/exec/common.ts';
import type {
  CommitFilesConfig,
  LongCommitSha,
} from '../../../util/git/types.ts';
import type { PlatformScm } from '../types.ts';

let fileList: string[] | undefined;
export class LocalFs implements PlatformScm {
  isBranchBehindBase(
    _branchName: string,
    _baseBranch: string,
  ): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchModified(_branchName: string, _baseBranch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchConflicted(_baseBranch: string, _branch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  branchExists(_branchName: string): Promise<boolean> {
    return Promise.resolve(true);
  }
  getBranchCommit(_branchName: string): Promise<LongCommitSha | null> {
    return Promise.resolve(null);
  }
  getBranchUpdateDate(_branchName: string): Promise<DateTime | null> {
    return Promise.resolve(null);
  }
  deleteBranch(_branchName: string): Promise<void> {
    return Promise.resolve();
  }
  commitAndPush(
    _commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    return Promise.resolve(null);
  }

  async getFileList(): Promise<string[]> {
    try {
      // fetch file list using git
      const maxBuffer = 10 * 1024 * 1024; // 10 MiB in bytes
      const stdout = (await rawExec('git ls-files', { maxBuffer })).stdout;
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

  checkoutBranch(_branchName: string): Promise<LongCommitSha> {
    // We don't care about the commit sha in local mode
    return Promise.resolve('' as LongCommitSha);
  }

  mergeAndPush(_branchName: string): Promise<void> {
    return Promise.resolve();
  }

  mergeToLocal(_branchName: string): Promise<void> {
    return Promise.resolve();
  }
}
