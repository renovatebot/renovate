import is from '@sindresorhus/is';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedModifiedResult(
  targetBranchName: string,
  targetBranchSha: string
): boolean | null {
  const { branches } = getCache();
  const targetBranch = branches?.find(
    (branch) => branch.branchName === targetBranchName
  );
  if (is.undefined(targetBranch)) {
    return null;
  }

  if (targetBranch.sha !== targetBranchSha) {
    return null;
  }

  return targetBranch.isModified;
}

export function setCachedModifiedResult(
  targetBranchName: string,
  targetBranchSha: string,
  isModified: boolean
): void {
  const cache = getCache();
  cache.branches ??= [];
  const { branches } = cache;
  const targetBranch =
    branches?.find((branch) => branch.branchName === targetBranchName) ??
    ({ branchName: targetBranchName } as BranchCache);

  // if branch not present add it to cache
  if (is.undefined(targetBranch.sha)) {
    branches.push(targetBranch);
  }

  if (targetBranch?.sha !== targetBranchSha) {
    targetBranch.sha = targetBranchSha;
  }

  targetBranch.isModified = isModified;
}
