import { randomUUID } from 'crypto';
import { logger } from '../../../logger';
import type { PrState } from '../../../types';
import * as git from '../../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import { toSha256 } from '../../../util/hasha';
import { DefaultGitScm } from '../default-scm';
import { client } from './client';
import { mapPrStateToGerritFilter } from './utils';

let repository: string;
let username: string;
export function configureScm(repo: string, login: string): void {
  repository = repo;
  username = login;
}

export class GerritScm extends DefaultGitScm {
  private createFilter(
    state: PrState,
    branchName: string,
    baseBranch?: string
  ): string[] {
    const filterState = mapPrStateToGerritFilter(state);
    const filter = ['owner:self', 'project:' + repository, filterState];
    filter.push(`hashtag:sourceBranch-${branchName}`);
    if (baseBranch) {
      filter.push(`branch:${baseBranch}`);
    }
    return filter;
  }

  override async branchExists(branchName: string): Promise<boolean> {
    const filter = this.createFilter('open', branchName);
    const change = await client.findChanges(filter).then((res) => res.pop());
    if (change) {
      return true;
    }
    return git.branchExists(branchName);
  }

  override async getBranchCommit(
    branchName: string
  ): Promise<CommitSha | null> {
    const filter = this.createFilter('open', branchName);
    const change = await client.findChanges(filter).then((res) => res.pop());
    if (change) {
      return change.current_revision!;
    }
    return git.getBranchCommit(branchName);
  }

  override async isBranchBehindBase(
    branchName: string,
    baseBranch: string
  ): Promise<boolean> {
    const filter = this.createFilter('open', branchName, baseBranch);
    const change = await client
      .findChanges(filter, true)
      .then((res) => res.pop());
    if (change) {
      const currentGerritPatchset = change.revisions![change.current_revision!];
      return currentGerritPatchset.actions?.['rebase'].enabled === true;
    }
    return true;
  }

  override async isBranchConflicted(
    baseBranch: string,
    branch: string
  ): Promise<boolean> {
    const filter = this.createFilter('open', branch, baseBranch);
    const change = (await client.findChanges(filter)).pop();
    if (change) {
      const mergeInfo = await client.getMergeableInfo(change);
      return !mergeInfo.mergeable;
    } else {
      logger.warn(
        `There is no open change with branch=${branch} and baseBranch=${baseBranch}`
      );
      return true;
    }
  }

  override async isBranchModified(branchName: string): Promise<boolean> {
    const filter = this.createFilter('open', branchName);
    const change = await client
      .findChanges(filter, true)
      .then((res) => res.pop());
    if (change) {
      const currentGerritPatchset = change.revisions![change.current_revision!];
      return currentGerritPatchset.uploader.username !== username;
    }
    return false;
  }

  override async commitAndPush(
    commit: CommitFilesConfig
  ): Promise<CommitSha | null> {
    logger.debug(`commitAndPush(${commit.branchName})`);
    const filter = this.createFilter(
      'open',
      commit.branchName,
      commit.baseBranch
    );
    const existingChange = await client
      .findChanges(filter, true)
      .then((res) => res.pop());

    let hasChanges = true;
    const origMsg =
      typeof commit.message === 'string' ? [commit.message] : commit.message;
    commit.message = [
      ...origMsg,
      `Change-Id: ${existingChange?.change_id ?? generateChangeId()}`,
    ];
    const commitResult = await git.prepareCommit(commit);
    if (commitResult) {
      const { commitSha } = commitResult;
      if (existingChange?.revisions && existingChange.current_revision) {
        const fetchRefSpec =
          existingChange.revisions[existingChange.current_revision].ref;
        await git.fetchRevSpec(fetchRefSpec); //fetch current ChangeSet for git diff
        hasChanges = await git.hasDiff('HEAD', 'FETCH_HEAD'); //avoid empty patchsets
      }
      if (hasChanges || commit.force) {
        const pushResult = await git.pushCommit({
          sourceRef: commit.branchName,
          targetRef: `refs/for/${commit.baseBranch!}%t=sourceBranch-${
            commit.branchName
          }`,
          files: commit.files,
        });
        if (pushResult) {
          //existingChange was the old change before commit/push. we need to approve again, if it was previously approved from renovate
          if (
            existingChange &&
            client.wasApprovedBy(existingChange, username)
          ) {
            await client.approveChange(existingChange._number);
          }
          return commitSha;
        }
      }
    }
    return null; //empty commit, no changes in this Gerrit-Change
  }

  override deleteBranch(branchName: string): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * This function should generate a Gerrit Change-ID analogous to the commit hook. We avoid the commit hook cause of security concerns.
 * random=$( (whoami ; hostname ; date; cat $1 ; echo $RANDOM) | git hash-object --stdin) prefixed with an 'I'.
 * TODO: Gerrit don't accept longer Change-IDs (sha256), but what happens with this https://git-scm.com/docs/hash-function-transition/ ?
 */
function generateChangeId(): string {
  return 'I' + toSha256(randomUUID()).substring(0, 40);
}
