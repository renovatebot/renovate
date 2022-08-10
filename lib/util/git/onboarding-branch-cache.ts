import type { ExtractResult } from '../../workers/repository/process/extract-update';
import { getCache } from '../cache/repository';
import type { OnboardingBranchCache } from '../cache/repository/types';
import { getBranchCommit } from '.';

export function getCachedOnboardingBranch(
  branchName: string,
  baseBranchName: string
): OnboardingBranchCache | null {
  const cache = getCache();
  const { onboardingBranch } = cache;
  if (!onboardingBranch || onboardingBranch?.sha === null) {
    return null;
  }
  const branchSha = getBranchCommit(branchName);
  const parentSha = getBranchCommit(baseBranchName);
  onboardingBranch.parentSha ??= cache.scan?.[baseBranchName].sha;
  if (
    onboardingBranch?.sha !== branchSha ||
    onboardingBranch.parentSha !== parentSha
  ) {
    return null;
  }
  return onboardingBranch;
}

export function setOnboardingBranchCache(
  branchName: string,
  baseBranchName: string,
  isOnboarded: boolean,
  extractedDependencies?: ExtractResult
): void {
  const cache = getCache();
  const { onboardingBranch = {} as OnboardingBranchCache } = cache;

  onboardingBranch.isOnboarded = isOnboarded;
  onboardingBranch.sha = getBranchCommit(branchName)!;
  onboardingBranch.parentSha = getBranchCommit(baseBranchName)!;
  if (extractedDependencies) {
    onboardingBranch.extractedDependencies = extractedDependencies;
  }
  cache.onboardingBranch ??= onboardingBranch;
  // eslint-disable-next-line no-console
  console.log(cache);
}
