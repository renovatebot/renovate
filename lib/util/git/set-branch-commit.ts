import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

/**
 * Called when a new commit is added to branch
 *
 * ie. when branch is created/updated
 */
export function setBranchNewCommit(
  branchName: string,
  baseBranch: string,
  commitSha: string,
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
}
