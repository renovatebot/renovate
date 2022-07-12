import is from '@sindresorhus/is';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedModifiedResult(
  branchName: string,
  branchSha: string
): boolean | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);
  if (is.undefined(branch)) {
    return null;
  }

  if (branch.sha !== branchSha) {
    return null;
  }

  return branch.isModified;
}

export function setCachedModifiedResult(
  branchName: string,
  branchSha: string,
  isModified: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  const { branches } = cache;
  const branch =
    branches?.find((branch) => branch.branchName === branchName) ??
    ({ branchName: branchName } as BranchCache);

  // if branch not present add it to cache
  if (is.undefined(branch.sha)) {
    branches.push(branch);
  }

  if (branch?.sha !== branchSha) {
    branch.sha = branchSha;
  }

  branch.isModified = isModified;
}
