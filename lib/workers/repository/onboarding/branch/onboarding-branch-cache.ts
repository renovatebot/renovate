import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { getCache } from '../../../../util/cache/repository';
import { getBranchCommit } from '../../../../util/git';

export function setOnboardingCache(
  defaultBranchSha: string,
  onboardingBranchSha: string,
  isConflicted: boolean
): void {
  // do not update cache if commit is null/undefined
  if (
    !(
      is.nonEmptyString(defaultBranchSha) &&
      is.nonEmptyString(onboardingBranchSha)
    )
  ) {
    logger.debug('Onboarding cache not updated');
    return;
  }

  const cache = getCache();
  const onboardingCache = {
    defaultBranchSha,
    onboardingBranchSha,
    isConflicted,
  };
  if (cache.onboardingBranchCache) {
    logger.debug('Onboarding cache updated');
  } else {
    logger.debug('Onboarding cache created');
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

export async function isOnboardingBranchModified(
  onboardingBranch: string
): Promise<boolean> {
  const cache = getCache();
  const onboardingSha = getBranchCommit(onboardingBranch);
  let isModified = false;

  if (cache.onboardingBranchCache) {
    isModified =
      onboardingSha !== cache.onboardingBranchCache.onboardingBranchSha;
  } else {
    isModified = await scm.isBranchModified(onboardingBranch);
  }

  return isModified;
}

export async function isOnboardingBranchConflicted(
  defaultBranch: string,
  onboardingBranch: string
): Promise<boolean> {
  const cache = getCache();
  const onboardingCache = cache.onboardingBranchCache;
  const onboardingSha = getBranchCommit(onboardingBranch);
  const defaultBranchSha = getBranchCommit(defaultBranch);
  let isConflicted = false;

  if (
    onboardingCache &&
    defaultBranchSha === onboardingCache.defaultBranchSha &&
    onboardingSha === onboardingCache.onboardingBranchSha
  ) {
    isConflicted = onboardingCache.isConflicted;
  } else {
    isConflicted = await scm.isBranchConflicted(
      defaultBranch,
      onboardingBranch
    );
  }

  return isConflicted;
}
