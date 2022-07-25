import { getCache } from '../cache/repository';

// Compare cached parent Sha of a branch to the fetched base-branch sha to determine whether the branch is behind the base
// Since cache is updated after each run, this will be sufficient to determine whether a branch is behind its parent.
export function getCachedBehindBaseResult(
  branchName: string,
  currentBaseBranchSha: string
): boolean | null {
  const cache = getCache();
  const { branches = [] } = cache;
  const cachedBranch = branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!cachedBranch?.parentSha) {
    return null;
  }

  return currentBaseBranchSha !== cachedBranch.parentSha;
}
