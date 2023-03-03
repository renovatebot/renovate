import { getCache } from '../../../../util/cache/repository';

export function setOnboardingCache(
  branchName: string,
  defaultBranchSha: string,
  onboardingBranchSha: string
): void {
  const cache = getCache();
  const onboardingCache = {
    branchName,
    defaultBranchSha,
    onboardingBranchSha,
  };

  cache.onboardingBranchCache = onboardingCache;
}

export function deleteOnboardingCache(): void {
  const cache = getCache();

  if (cache?.onboardingBranchCache) {
    delete cache.onboardingBranchCache;
  }
}
