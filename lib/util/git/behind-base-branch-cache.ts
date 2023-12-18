import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import type { LongCommitSha } from './types';

export function getCachedBehindBaseResult(
  branchName: string,
  branchSha: LongCommitSha | null,
  baseBranch: string,
  baseBranchSha: LongCommitSha | null,
): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName,
  );

  if (
    branch &&
    branch.sha === branchSha &&
    branch.baseBranch === baseBranch &&
    branch.baseBranchSha === baseBranchSha &&
    branch.isBehindBase !== undefined
  ) {
    return branch.isBehindBase;
  }

  return null;
}

export function setCachedBehindBaseResult(
  branchName: string,
  isBehindBase: boolean,
): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName,
  );

  if (!branch) {
    logger.debug(`setCachedBehindBaseResult(): Branch cache not present`);
    return;
  }

  branch.isBehindBase = isBehindBase;
}
