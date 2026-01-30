import { randomUUID } from 'crypto';
import { logger } from '../../../logger/index.ts';
import * as git from '../../../util/git/index.ts';
import type {
  CommitFilesConfig,
  LongCommitSha,
} from '../../../util/git/types.ts';
import { hash } from '../../../util/hash.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { client } from './client.ts';

/**
 * Gerrit SCM strategy:
 * Instead of implementing custom branch operations, we fetch all open Gerrit changes
 * as Git refs (refs/remotes/origin/branchName) after repository initialization.
 * This allows us to leverage DefaultGitScm for most operations, treating Gerrit changes
 * as regular Git branches, while minimizing Gerrit API requests.
 */

let repository: string;
export function configureScm(repo: string): void {
  repository = repo;
}

// TODO: this can be optimzed further by avoiding client.findChanges() since the change was initialized locally as commit.branchName.
// Note the change should be pushed to refs/for/<existing change branch> instead of just targetBranch, for the case when a change will be moved to a different target branch.
// Not sure how to get the existing change branch without querying Gerrit API though. Maybe by storing this additional information when initializing the changes as branches?
// git.fetchRevSpec() can also be replaced with some local git command.
export class GerritScm extends DefaultGitScm {
  override async commitAndPush(
    commit: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    logger.debug(`commitAndPush(${commit.branchName})`);
    const existingChange = await client.getBranchChange(repository, {
      branchName: commit.branchName,
      state: 'open',
      targetBranch: commit.baseBranch,
      requestDetails: ['CURRENT_REVISION'],
    });

    let hasChanges = true;
    const message =
      typeof commit.message === 'string' ? [commit.message] : commit.message;

    // In Gerrit, the change subject/title is the first line of the commit message
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
    const commitResult = await git.prepareCommit({ ...commit, force: true });
    if (commitResult) {
      const { commitSha } = commitResult;
      if (existingChange) {
        const currentRevision =
          existingChange.revisions![existingChange.current_revision!];
        const fetchRefSpec = currentRevision.ref;
        await git.fetchRevSpec(fetchRefSpec); // fetch current ChangeSet for git diff
        hasChanges = await git.hasDiff('HEAD', 'FETCH_HEAD'); // avoid pushing empty patch sets
      }
      if (hasChanges || commit.force) {
        const pushOptions = ['notify=NONE'];
        if (commit.autoApprove) {
          pushOptions.push('label=Code-Review+2');
        }
        if (commit.labels) {
          for (const label of commit.labels) {
            pushOptions.push(`hashtag=${label}`);
          }
        }
        // If a change already exists, we push to the same target branch to
        // avoid creating a new change if the base branch has changed.
        // updatePr() will take care of moving the existing change to a different base
        // branch if needed.
        const changeBranch = existingChange?.branch ?? commit.baseBranch!;
        const pushResult = await git.pushCommit({
          sourceRef: commit.branchName,
          targetRef: `refs/for/${changeBranch}`,
          files: commit.files,
          pushOptions,
        });
        if (pushResult) {
          return commitSha;
        }
      }
    }
    return null; // empty commit, no changes in this Gerrit Change
  }

  // Delete virtual branch created from a Gerrit change ref
  // Note: Gerrit changes themselves are abandoned through the API, not deleted as branches
  override async deleteBranch(branchName: string): Promise<void> {
    await git.deleteVirtualBranch(branchName);
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
