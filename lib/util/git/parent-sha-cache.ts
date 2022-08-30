import { getCache } from '../cache/repository';

export function getCachedBranchParentShaResult(
  branchName: string,
  branchSha: string | null
): string | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.baseBranchSha && branchSha === branch?.sha) {
    return branch.baseBranchSha;
  }

  return null;
}
