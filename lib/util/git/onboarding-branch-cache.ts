// istanbul ignore file
import type { ExtractResult } from '../../workers/repository/process/extract-update';
import { getCache } from '../cache/repository';
import type { OnboardingBranchCache } from '../cache/repository/types';

export function getCachedOnboardingBranch(
  branchSha: string,
  baseBranchSha: string,
  baseBranchName: string
): OnboardingBranchCache | null {
  const cache = getCache();
  const { onboardingBranch } = cache;
  if (!onboardingBranch || onboardingBranch.sha === null) {
    return null;
  }

  onboardingBranch.parentSha ??= cache.scan?.[baseBranchName].sha;
  if (
    onboardingBranch.sha !== branchSha ||
    onboardingBranch.parentSha !== baseBranchSha
  ) {
    return null;
  }
  return onboardingBranch;
}

export function setOnboardingBranchCache(
  branchSha: string,
  baseBranchSha: string,
  isOnboarded: boolean,
  extractedDependencies?: ExtractResult
): void {
  const cache = getCache();
  const onboardingBranch =
    cache.onboardingBranch ?? ({} as OnboardingBranchCache);

  onboardingBranch.isOnboarded = isOnboarded;
  onboardingBranch.sha = branchSha;
  onboardingBranch.parentSha = baseBranchSha;
  if (extractedDependencies) {
    onboardingBranch.extractedDependencies = extractedDependencies;
  }
  cache.onboardingBranch = onboardingBranch;
}
