import { getCache } from '../cache/repository';

export function getCachedPristineResult(branchName: string): boolean {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName,
  );

  return branch?.pristine ?? false;
}
