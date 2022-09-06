import { getCache } from '../cache/repository';
import { getBranchCommit } from '.';

// Compare cached baseBranchSha of a branch and fetched baseBranchSha to determine if the branch is behind base
// since we update cache on each run, it is sufficient to determine whether a branch is behind its parent
export function getCachedBehindBaseResult(
  branchName: string,
  baseBranchName: string
): boolean | null {
  const cache = getCache();
  const baseBranchSha = getBranchCommit(baseBranchName);
  const { branches = [] } = cache;
  const cachedBranch = branches?.find(
    (branch) => branch.branchName === branchName
  );

  if (!cachedBranch?.baseBranchSha) {
    return null;
  }

  return baseBranchSha !== cachedBranch.baseBranchSha;
}
