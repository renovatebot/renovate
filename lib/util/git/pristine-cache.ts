import { logger } from '../../logger';
import { getCache } from '../cache/repository';

export function getCachedPristineResult(branchName: string): boolean {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  return branch?.pristine ?? false;
}

export function setCachedPristineResult(branchName: string): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    logger.debug(`setCachedPristineResult(): Branch cache not present`);
    return;
  }

  branch.pristine = false;
}
