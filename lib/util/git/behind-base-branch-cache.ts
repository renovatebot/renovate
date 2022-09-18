import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import { getBranchCommit } from '.';

export function getCachedBehindBaseResult(
  branchName: string,
  baseBranch: string
): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (branch) {
    const branchSha = getBranchCommit(branchName);
    const baseBranchSha = getBranchCommit(baseBranch);

    if (
      branch.sha === branchSha &&
      branch.baseBranchSha === baseBranchSha &&
      branch.isBehindBase !== undefined
    ) {
      return branch.isBehindBase;
    }
  }

  return null;
}

export function setCachedBehindBaseResult(
  branchName: string,
  isBehindBase: boolean
): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    logger.debug(`Branch cache not present for ${branchName}`);
    return;
  }

  branch.isBehindBase = isBehindBase;
}
