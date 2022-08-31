import { partial } from '../../../test/util';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedBaseBranchShaResult(
  branchName: string
): string | null {
  const { branches } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);

  if (branch?.baseBranchSha) {
    return branch.baseBranchSha;
  }

  return null;
}

export function setCachedBaseBranchShaResult(
  branchName: string,
  baseBranchSha: string
): void {
  const cache = getCache();
  cache.branches ??= [];

  let branch = cache.branches.find(
    (branch) => branch.branchName === branchName
  );
  if (!branch) {
    branch = partial<BranchCache>({
      branchName: branchName,
    });
    cache.branches.push(branch);
  }
  branch.baseBranchSha = baseBranchSha;
}
