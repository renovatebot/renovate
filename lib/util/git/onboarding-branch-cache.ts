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
  const { onboarding: onboardingBranch } = cache;
  if (!onboardingBranch) {
    return null;
  }

  onboardingBranch.defaultBranchSha ??= cache.scan?.[baseBranchName].sha;
  if (
    onboardingBranch.onboardingBranchSha !== branchSha ||
    onboardingBranch.defaultBranchSha !== baseBranchSha
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
  const onboardingBranch = cache.onboarding ?? ({} as OnboardingBranchCache);

  onboardingBranch.isOnboarded = isOnboarded;
  onboardingBranch.onboardingBranchSha = branchSha;
  onboardingBranch.defaultBranchSha = baseBranchSha;
  if (extractedDependencies) {
    onboardingBranch.extractedDependencies = extractedDependencies;
  }
  cache.onboarding = onboardingBranch;
}
