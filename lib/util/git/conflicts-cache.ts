import { logger } from '../../logger';
import { getCache } from '../cache/repository';

export function getCachedConflictResult(
  branchName: string,
  branchSha: string | null,
  baseBranch: string,
  baseBranchSha: string | null
): boolean | null {
  const cache = getCache();
  if (!cache.gitConflicts) {
    delete cache.gitConflicts;
  }

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
  isConflicted: boolean
): void {
  const cache = getCache();
  const branch = cache?.branches?.find((br) => br.branchName === branchName);

  if (!branch) {
    logger.debug(`setCachedBehindBaseResult(): Branch cache not present`);
    return;
  }

  branch.isConflicted = isConflicted;
}
