import { getCache } from '../cache/repository';
import type { OnboardingCache } from '../cache/repository/types';

export function validateAndRetrieveOnboardingCache(
  baseBranchSha: string,
  baseBranchName: string
): OnboardingCache | null {
  const cache = getCache();
  const { onboarding: onboardingBranch } = cache;
  if (!onboardingBranch) {
    return null;
  }

  onboardingBranch.defaultBranchSha ??= cache.scan?.[baseBranchName].sha;
  if (onboardingBranch.defaultBranchSha !== baseBranchSha) {
    return null;
  }
  return onboardingBranch;
}

export function setOnboardingBranchCache(
  branchSha: string,
  baseBranchSha: string,
  isOnboarded: boolean,
  configFile: string,
  onboardingConfigRaw: string
): void {
  const cache = getCache();
  const onboardingBranch = cache.onboarding ?? ({} as OnboardingCache);

  onboardingBranch.isOnboarded = isOnboarded;
  onboardingBranch.onboardingBranchSha = branchSha;
  onboardingBranch.defaultBranchSha = baseBranchSha;
  onboardingBranch.configFileName = configFile;
  onboardingBranch.onboardingConfigRaw = onboardingConfigRaw;
}
