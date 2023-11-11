import { logger } from '../../logger';
import { getCache } from '../cache/repository';

export function getCachedConflictResult(
  branchName: string,
  branchSha: string,
  baseBranch: string,
  baseBranchSha: string,
): boolean | null {
  const cache = getCache();
  const branch = cache?.branches?.find((br) => br.branchName === branchName);
  if (
    branch &&
    branch.baseBranch === baseBranch &&
    branch.baseBranchSha === baseBranchSha &&
    branch.sha === branchSha &&
    branch.isConflicted !== undefined
  ) {
    return branch.isConflicted;
  }

  return null;
}

export function setCachedConflictResult(
  branchName: string,
  isConflicted: boolean,
): void {
  const cache = getCache();
  const branch = cache?.branches?.find((br) => br.branchName === branchName);

  if (!branch) {
    logger.debug(`setCachedConflictResult(): Branch cache not present`);
    return;
  }

  branch.isConflicted = isConflicted;
}
