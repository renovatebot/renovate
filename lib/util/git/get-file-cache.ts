import { getCache } from '../cache/repository';
import type { BranchCache } from '../cache/repository/types';

export function getCachedFile(
  branchName: string,
  branchSha: string,
  filePath: string
): string | null {
  const { branches = [] } = getCache();
  const branch = branches?.find((branch) => branch.branchName === branchName);
  const fileContent = branch?.contents?.[filePath];

  if (branch?.sha !== branchSha || fileContent === undefined) {
    return null;
  }
  return fileContent;
}

export function setCachedFile(
  branchName: string,
  branchSha: string,
  filePath: string,
  content: string
): void {
  const cache = getCache();
  cache.branches ??= [];
  const { branches } = cache;
  const branch =
    branches?.find((branch) => branch.branchName === branchName) ??
    ({ branchName: branchName } as BranchCache);

  // if branch not present add it to cache
  if (branch.sha === undefined) {
    branches.push(branch);
  }

  if (branch.sha !== branchSha) {
    branch.sha = branchSha;
  }

  branch.contents ||= {};
  branch.contents[filePath] = content;
}
