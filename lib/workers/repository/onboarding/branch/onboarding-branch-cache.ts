import { logger } from '../../../../logger';
import { getCache } from '../../../../util/cache/repository';

export function setOnboardingCache(
  onboardingBranch: string,
  defaultBranchSha: string,
  onboardingBranchSha: string
): void {
  const cache = getCache();
  const onboardingCache = {
    onboardingBranch,
    defaultBranchSha,
    onboardingBranchSha,
  };
  if (cache.onboardingBranchCache) {
    logger.debug('Update Onboarding Cache');
  } else {
    logger.debug('Create Onboarding Cache');
  }
  cache.onboardingBranchCache = onboardingCache;
}

export function deleteOnboardingCache(): void {
  const cache = getCache();

  if (cache?.onboardingBranchCache) {
    logger.debug('Delete Onboarding Cache');
    delete cache.onboardingBranchCache;
  }
}
