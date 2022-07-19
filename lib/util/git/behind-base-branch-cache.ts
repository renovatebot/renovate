import { getCache } from '../cache/repository';

export function getCachedBehindBaseResult(
  branchName: string,
  currentBaseBranchSha: string
): boolean | null {
  const cache = getCache();
  const { branches = [] } = cache;
  const cachedBranch = branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!cachedBranch) {
    return null;
  }

  return !(currentBaseBranchSha === cachedBranch.parentSha);
}
