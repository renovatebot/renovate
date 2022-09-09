import { getCache } from '../cache/repository';

export function getCachedBehindBaseResult(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string
): boolean | null {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

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
  isBehind: boolean
): void {
  const cache = getCache();
  const branch = cache.branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!branch) {
    return;
  }

  branch.isBehindBaseBranch = isBehind;
}
