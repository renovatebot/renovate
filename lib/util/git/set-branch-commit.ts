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
  commitSha: string
): void {
  logger.debug('setBranchCommit()');
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    logger.debug(
      `setBranchCommit(): Branch cache not present for ${branchName}`
    ); // should never be called
    branch = {
      branchName,
      baseBranch,
    } as BranchCache;
    cache.branches.push(branch);
  }

  const baseBranchSha = getBranchCommit(baseBranch);

  branch.sha = commitSha;
  branch.baseBranchSha = baseBranchSha;
  branch.isBehindBase = false;
  branch.isModified = false;
  branch.parentSha = baseBranchSha;
}
