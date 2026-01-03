import fs from 'fs-extra';
import { glob } from 'glob';
import { simpleGit } from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
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

  isBranchModified(branchName: string, baseBranch: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  isBranchConflicted(baseBranch: string, branch: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  async branchExists(branchName: string): Promise<boolean> {
    try {
      const localDir = GlobalConfig.get('localDir') ?? process.cwd();
      const git = simpleGit(localDir);
      const branches = await git.branchLocal();
      return branches.all.includes(branchName);
    } catch {
      return false;
    }
  }

  async getBranchCommit(branchName: string): Promise<LongCommitSha | null> {
    try {
      const localDir = GlobalConfig.get('localDir') ?? process.cwd();
      const git = simpleGit(localDir);
      const commit = await git.revparse([branchName]);
      return commit.trim() as LongCommitSha;
    } catch {
      return null;
    }
  }

  async deleteBranch(branchName: string): Promise<void> {
    try {
      const localDir = GlobalConfig.get('localDir') ?? process.cwd();
      const git = simpleGit(localDir);
      await git.deleteLocalBranch(branchName, true);
      logger.debug(`Deleted local branch ${branchName}`);
    } catch (err) {
      logger.debug({ err, branchName }, 'Failed to delete local branch');
    }
  }

  async commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    const { branchName, files, message } = commitConfig;
    const localDir = GlobalConfig.get('localDir') ?? process.cwd();
    const git = simpleGit(localDir);

    try {
      // Get the current branch to use as base
      const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);

      // Create and checkout the new branch from current HEAD
      logger.debug(`Creating local branch ${branchName}`);
      await git.checkoutLocalBranch(branchName);

      const addedModifiedFiles: string[] = [];
      const deletedFiles: string[] = [];

      // Process each file
      for (const file of files) {
        const filePath = upath.join(localDir, file.path);

        if (file.type === 'deletion') {
          try {
            await git.rm([file.path]);
            deletedFiles.push(file.path);
          } catch (err) {
            logger.debug({ err, filePath: file.path }, 'Failed to delete file');
          }
        } else {
          if (file.contents === null) {
            continue;
          }

          let contents: Buffer;
          if (typeof file.contents === 'string') {
            contents = Buffer.from(file.contents);
          } else {
            contents = file.contents;
          }

          if (file.isSymlink) {
            await fs.symlink(file.contents, filePath);
          } else {
            await fs.outputFile(filePath, contents, {
              mode: file.isExecutable ? 0o777 : 0o666,
            });
          }

          await git.add(file.path);
          if (file.isExecutable) {
            await git.raw(['update-index', '--chmod=+x', file.path]);
          }
          addedModifiedFiles.push(file.path);
        }
      }

      // Commit the changes
      const commitRes = await git.commit(message);
      logger.debug(
        { deletedFiles, addedModifiedFiles, result: commitRes },
        'git commit (local)',
      );

      if (commitRes.summary.changes === 0 && commitRes.summary.insertions === 0 && commitRes.summary.deletions === 0) {
        logger.warn('Detected empty commit - no changes made');
        // Switch back to original branch
        await git.checkout(currentBranch.trim());
        return null;
      }

      const commitSha = (await git.revparse([branchName])).trim() as LongCommitSha;
      logger.debug(`Created local branch ${branchName} with commit ${commitSha}`);

      // Switch back to the original branch
      await git.checkout(currentBranch.trim());

      return commitSha;
    } catch (err) {
      logger.error({ err, branchName }, 'Failed to create local branch and commit');
      return null;
    }
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

  async checkoutBranch(branchName: string): Promise<LongCommitSha> {
    try {
      const localDir = GlobalConfig.get('localDir') ?? process.cwd();
      const git = simpleGit(localDir);
      await git.checkout(branchName);
      const commitSha = await git.revparse(['HEAD']);
      return commitSha.trim() as LongCommitSha;
    } catch {
      return '' as LongCommitSha;
    }
  }

  mergeAndPush(_branchName: string): Promise<void> {
    return Promise.resolve();
  }

  mergeToLocal(_branchName: string): Promise<void> {
    return Promise.resolve();
  }
}
