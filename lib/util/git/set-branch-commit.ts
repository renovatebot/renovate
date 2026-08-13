import type { DateTime } from 'luxon';
import { logger } from '../../logger/index.ts';
import { getCache } from '../cache/repository/index.ts';
import type { BranchCache } from '../cache/repository/types.ts';
import { getBranchCommit } from './index.ts';

/**
 * Called when a new commit is added to branch
 *
 * ie. when branch is created/updated
 */
export function setBranchNewCommit(
  branchName: string,
  baseBranch: string,
  commitSha: string,
  commitTimestamp: DateTime | null,
): void {
  logger.debug('setBranchCommit()');
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    logger.debug(`setBranchCommit(): Branch cache not present`); // should never be called
    branch = {
      branchName,
      baseBranch,
    } as BranchCache;
    cache.branches.push(branch);
  }

  const baseBranchSha = getBranchCommit(baseBranch);

  branch.baseBranchSha = baseBranchSha;
  branch.isBehindBase = false;
  branch.isConflicted = false;
  branch.isModified = false;
  branch.pristine = true;
  branch.sha = commitSha;
  if (commitTimestamp) {
    branch.commitTimestamp = commitTimestamp.toISO()!;
  }
}
