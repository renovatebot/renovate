import { getCache } from '../cache/repository';

export function getCachedModifiedResult(
  branchName: string,
  branchSha: string
): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (branch && branch.sha === branchSha && branch.isModified !== undefined) {
    return branch.isModified;
  }

  return null;
}

export function setCachedModifiedResult(
  branchName: string,
  isModified: boolean
): void {
  const cache = getCache();
  const { branches } = cache;
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (!branch) {
    return;
  }

  branch.isModified = isModified;
}
