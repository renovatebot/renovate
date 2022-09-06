import { getCache } from '../cache/repository';
import { getBranchCommit } from '.';

// Compare cached parent Sha of a branch to the fetched base-branch sha to determine whether the branch is behind the base
// Since cache is updated after each run, this will be sufficient to determine whether a branch is behind its parent.
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
