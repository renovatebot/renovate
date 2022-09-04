import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedBehindBaseResult(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string
): boolean | null {
  const cache = getCache();
  const { branches = [] } = cache;
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (
    branch &&
    branch.baseBranchName === baseBranchName &&
    branch.baseBranchSha === baseBranchSha &&
    branch.sha === branchSha &&
    branch.isBehindBaseBranch !== undefined
  ) {
    return branch.isBehindBaseBranch;
  }
  return null;
}

export function setCachedBehindBaseResult(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string,
  isBehind: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    branch = {
      branchName: branchName,
      baseBranchName: baseBranchName,
      sha: branchSha,
      baseBranchSha: baseBranchSha,
    } as BranchCache;
    cache.branches.push(branch);
  }

  if (branch.sha !== branchSha) {
    logger.warn('Invalid Cache. Branch sha mismatch');
  }

  if (branch.baseBranchSha !== baseBranchSha) {
    logger.warn('Invalid Cache. Base branch sha mismatch');
  }

  if (branch.baseBranchName !== baseBranchName) {
    logger.warn('Invalid Cache. Base branch name mismatch');
  }

  branch.isBehindBaseBranch = isBehind;
}
