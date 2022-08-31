import { partial } from '../../../test/util';
import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function setBranchShas(
  branchName: string,
  baseBranchName: string,
  commitSha: string
): void {
  const cache = getCache();
  const baseBranchSha = getBranchCommit(baseBranchName);
  // eslint-disable-next-line no-console
  console.log('BEFORE UPDATE:', cache);
  cache.branches ??= [];

  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    branch = partial<BranchCache>({
      branchName: branchName,
      baseBranchName: baseBranchName,
    });
    cache.branches.push(branch);
  }
  branch.sha = commitSha;
  branch.baseBranchSha = baseBranchSha;
  branch.parentSha = baseBranchSha;
  branch.isConflicted = false;
  branch.isModified = false;
  // eslint-disable-next-line no-console
  console.log('AFTER UPDATE:', cache);
}
