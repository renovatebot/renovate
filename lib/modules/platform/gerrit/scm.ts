import { randomUUID } from 'crypto';
import { logger } from '../../../logger/index.ts';
import * as git from '../../../util/git/index.ts';
import type {
  CommitFilesConfig,
  FileChange,
  LongCommitSha,
} from '../../../util/git/types.ts';
import { hash } from '../../../util/hash.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { client } from './client.ts';

/**
 * Gerrit SCM strategy:
 * Instead of implementing custom branch operations, we fetch all open Gerrit changes
 * as virtual branches (refs/remotes/origin/<branchName>) after repository initialization.
 * This allows us to leverage DefaultGitScm for most operations, treating virtual branches
 * as regular Git branches, while minimizing Gerrit API requests.
 */

let repository: string;
export function configureScm(repo: string): void {
  repository = repo;
}

/** Branches with a local commit but no Gerrit change yet (push deferred to createPr()). */
export const pendingChangeBranches = new Set<string>();

export async function pushForReview(options: {
  sourceRef: string;
  targetBranch: string;
  files: FileChange[];
  autoApprove?: boolean;
  labels?: string[];
}): Promise<boolean> {
  const pushOptions = ['notify=NONE', 'ready'];
  if (options.autoApprove) {
    pushOptions.push('label=Code-Review+2');
  }
  if (options.labels) {
    for (const label of options.labels) {
      pushOptions.push(`hashtag=${label}`);
    }
  }

  const result = await git.pushCommit({
    sourceRef: options.sourceRef,
    targetRef: `refs/for/${options.targetBranch}`,
    files: options.files,
    pushOptions,
  });
  if (result) {
    pendingChangeBranches.delete(options.sourceRef);
    await git.updateVirtualBranch(options.sourceRef);
  }
  return result;
}

export class GerritScm extends DefaultGitScm {
  override async commitAndPush(
    commit: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    logger.debug(`commitAndPush(${commit.branchName})`);

    const existingChange = await client.getBranchChange(repository, {
      branchName: commit.branchName,
      state: 'open',
      targetBranch: commit.baseBranch,
    });

    const message =
      typeof commit.message === 'string' ? [commit.message] : commit.message;

    // In Gerrit, the change subject/title is the first line of the commit message
    // v8 ignore else -- TODO: add test #40625
    if (commit.prTitle) {
      const firstMessageLines = message[0].split('\n');
      firstMessageLines[0] = commit.prTitle;
      message[0] = firstMessageLines.join('\n');
    }

    const changeId = existingChange?.change_id ?? generateChangeId();
    commit.message = [
      ...message,
      `Renovate-Branch: ${commit.branchName}\nChange-Id: ${changeId}`,
    ];
    // prepareCommit already checks hasDiff('HEAD', 'origin/<branchName>') when
    // force is not set, which works because virtual branches are fetched as
    // refs/remotes/origin/<branchName> during init.  This avoids pushing empty
    // patch sets without a separate diff check.
    const commitResult = await git.prepareCommit(commit);
    if (commitResult) {
      const { commitSha } = commitResult;
      if (existingChange) {
        // Since the change already exists, we push to the same target branch to
        // avoid creating a new change if the base branch has changed.
        // updatePr() will later take care of moving the existing change to a
        // different base branch if needed.
        const pushResult = await pushForReview({
          sourceRef: commit.branchName,
          targetBranch: existingChange.branch,
          files: commit.files,
          autoApprove: commit.autoApprove,
        });
        /* v8 ignore else -- should never happen */
        if (pushResult) {
          return commitSha;
        }
      } else {
        logger.debug(`Commit prepared, push deferred to createPr()`);
        pendingChangeBranches.add(commit.branchName);
        return commitSha;
      }
    }
    return null; // empty commit, no changes in this Gerrit Change
  }

  // Delete virtual branch created from a Gerrit change
  // Note: Gerrit changes themselves are abandoned through the API, not deleted as branches
  override async deleteBranch(branchName: string): Promise<void> {
    pendingChangeBranches.delete(branchName);
    await git.deleteVirtualBranch(branchName);
  }

  override async mergeToLocal(branchName: string): Promise<void> {
    // Unpushed branches can't be fetched from origin, merge locally instead
    if (pendingChangeBranches.has(branchName)) {
      logger.debug(`Merging local branch ${branchName} (not yet pushed)`);
      return git.mergeToLocal(branchName, { localBranch: true });
    }
    return super.mergeToLocal(branchName);
  }
}

/**
 * This function should generate a Gerrit Change-ID analogous to the commit hook. We avoid the commit hook cause of security concerns.
 * random=$( (whoami ; hostname ; date; cat $1 ; echo $RANDOM) | git hash-object --stdin) prefixed with an 'I'.
 * TODO: Gerrit don't accept longer Change-IDs (sha256), but what happens with this https://git-scm.com/docs/hash-function-transition/ ?
 */
function generateChangeId(): string {
  return 'I' + hash(randomUUID(), 'sha1');
}
