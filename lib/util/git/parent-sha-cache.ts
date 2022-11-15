import { getCache } from '../cache/repository';

export function getCachedBranchParentShaResult(
  branchName: string,
  branchSha: string | null
): string | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.parentSha && branchSha === branch?.sha) {
    return branch.parentSha;
  }

  return null;
}

export function deleteCachedBranchParentShaResult(branchName: string): void {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.parentSha) {
    delete branch.parentSha;
  }
}
