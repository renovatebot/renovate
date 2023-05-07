/* istanbul ignore file */
import { glob } from 'glob';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import type { PlatformScm } from '../types';

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
    fileList ??= await glob('**', {
      dot: true,
      nodir: true,
      ignore: {
        childrenIgnored: (p) => p.isNamed('.git') || p.isNamed('node_modules'),
      },
    });
    return fileList;
  }

  checkoutBranch(branchName: string): Promise<CommitSha> {
    return Promise.resolve('');
  }
}
