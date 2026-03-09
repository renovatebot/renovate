import { isNonEmptyObject } from '@sindresorhus/is';
import { logger } from '../../logger/index.ts';
import { getCache } from '../cache/repository/index.ts';
import type { LongCommitSha } from './types.ts';

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
    isNonEmptyObject(branch) &&
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
