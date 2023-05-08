/* istanbul ignore file */

import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { logger } from '../../../logger';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import type { PlatformScm } from '../types';

const execAsync = promisify(exec);

let fileList: string[] | undefined;
export class LocalFs implements PlatformScm {
  fileList: string[] | undefined;

  isBranchBehindBase(branchName: string, baseBranch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchModified(branchName: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  isBranchConflicted(baseBranch: string, branch: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  branchExists(branchName: string): Promise<boolean> {
    return Promise.resolve(true);
  }
  getBranchCommit(branchName: string): Promise<string | null> {
    return Promise.resolve(null);
  }
  deleteBranch(branchName: string): Promise<void> {
    return Promise.resolve();
  }
  commitAndPush(commitConfig: CommitFilesConfig): Promise<string | null> {
    return Promise.resolve(null);
  }

  async getFileList(): Promise<string[]> {
    try {
      // fetch file list using git
      const { stdout } = await execAsync('git ls-files');
      logger.debug('Got file list using git');
      fileList = stdout.split('\n');
    } catch (err) {
      logger.debug('Could not get file list using git, using glob instead');
      fileList ??= await glob('**', {
        dot: true,
        nodir: true,
        ignore: {
          childrenIgnored: (p) => p.isNamed('.git'),
        },
      });
    }

    return fileList;
  }

  checkoutBranch(branchName: string): Promise<CommitSha> {
    return Promise.resolve('');
  }
}
