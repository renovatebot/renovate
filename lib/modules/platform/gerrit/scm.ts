import { randomUUID } from 'crypto';
import { logger } from '../../../logger';
import * as git from '../../../util/git';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { hash } from '../../../util/hash';
import { DefaultGitScm } from '../default-scm';
import { client } from './client';
import type { GerritFindPRConfig } from './types';
import { extractSourceBranch } from './utils';

let repository: string;
export function configureScm(repo: string, login: string): void {
  repository = repo;

  // Register hook to initialize branches before fetchBranchCommits
  git.setAfterFetchBranchCommits(() => initializeBranchesFromChanges(repo));
}

/**
 * Initialize local branches for all open Gerrit changes.
 * This allows the DefaultGitScm to work with Gerrit changes as if they were regular Git branches.
 */
export async function initializeBranchesFromChanges(
  repo: string,
): Promise<void> {
  logger.debug('Initializing local branches from open Gerrit changes');
  const openChanges = await client.findChanges(repo, {
    branchName: '',
    state: 'open',
    requestDetails: ['CURRENT_REVISION', 'COMMIT_FOOTERS'],
  });

  logger.debug(`Found ${openChanges.length} open Gerrit changes`);

  // Build a map of refspecs to branch names for bulk fetching
  const refspecMap = new Map<string, string>();
  for (const change of openChanges) {
    const sourceBranch = extractSourceBranch(change);
    if (sourceBranch && change.current_revision) {
      const currentRevision = change.revisions![change.current_revision];
      const refSpec = currentRevision.ref;
      refspecMap.set(refSpec, sourceBranch);
      logger.debug(
        { sourceBranch, changeNumber: change._number, refSpec },
        'Mapped Gerrit change to branch',
      );
    }
  }

  if (refspecMap.size > 0) {
    try {
      await git.initializeBranchesFromRefspecs(refspecMap);
      logger.debug('Finished initializing branches from Gerrit changes');
    } catch (err) {
      logger.debug(
        { err },
        'Failed to initialize branches from Gerrit changes',
      );
    }
  } else {
    logger.debug('No Gerrit changes to initialize');
  }
}

export class GerritScm extends DefaultGitScm {
  override async commitAndPush(
    commit: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    logger.debug(`commitAndPush(${commit.branchName})`);
    const searchConfig: GerritFindPRConfig = {
      state: 'open',
      branchName: commit.branchName,
      targetBranch: commit.baseBranch,
      singleChange: true,
      requestDetails: ['CURRENT_REVISION'],
    };
    const existingChange = (
      await client.findChanges(repository, searchConfig)
    ).pop();

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
        const pushResult = await git.pushCommit({
          sourceRef: commit.branchName,
          targetRef: `refs/for/${commit.baseBranch!}`,
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

  // Delete local branch and remote-tracking ref created from Gerrit change
  // Note: Gerrit changes themselves are abandoned through the API, not deleted as branches
  override async deleteBranch(branchName: string): Promise<void> {
    await git.deleteBranchCreatedFromRefspec(branchName);
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
