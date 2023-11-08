import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { getCache } from '../../../../util/cache/repository';
import { getBranchCommit } from '../../../../util/git';

export function setOnboardingCache(
  defaultBranchSha: string,
  onboardingBranchSha: string,
  isConflicted: boolean,
  isModified: boolean,
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
    isModified,
  };
  if (cache.onboardingBranchCache) {
    logger.debug({ onboardingCache }, 'Update Onboarding Cache');
  } else {
    logger.debug({ onboardingCache }, 'Create Onboarding Cache');
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

// checks if onboarding branch has been modified since last run
// return true if cache isn't present
export function hasOnboardingBranchChanged(onboardingBranch: string): boolean {
  const cache = getCache();
  const onboardingSha = getBranchCommit(onboardingBranch);

  if (cache.onboardingBranchCache) {
    return onboardingSha !== cache.onboardingBranchCache.onboardingBranchSha;
  }
  return true;
}

// checks if onboarding branch has been modified by user
// once set to true it stays true as we do not rebase onboarding branches anymore (this feature will be added in future though)
export async function isOnboardingBranchModified(
  onboardingBranch: string,
): Promise<boolean> {
  const cache = getCache();
  const onboardingCache = cache.onboardingBranchCache;
  const onboardingSha = getBranchCommit(onboardingBranch);
  let isModified = false;

  if (
    onboardingCache &&
    onboardingSha === onboardingCache.onboardingBranchSha &&
    !is.undefined(onboardingCache.isModified)
  ) {
    return onboardingCache.isModified;
  } else {
    isModified = await scm.isBranchModified(onboardingBranch);
  }

  return isModified;
}

export function getOnboardingFileNameFromCache(): string | undefined {
  const cache = getCache();
  return cache.onboardingBranchCache?.configFileName;
}

export function getOnboardingConfigFromCache(): string | undefined {
  const cache = getCache();
  return cache.onboardingBranchCache?.configFileParsed;
}

export function setOnboardingConfigDetails(
  configFileName: string,
  configFileParsed: string,
): void {
  const cache = getCache();
  if (cache.onboardingBranchCache) {
    cache.onboardingBranchCache.configFileName = configFileName;
    cache.onboardingBranchCache.configFileParsed = configFileParsed;
  }
}

export async function isOnboardingBranchConflicted(
  defaultBranch: string,
  onboardingBranch: string,
): Promise<boolean> {
  const cache = getCache();
  const onboardingCache = cache.onboardingBranchCache;
  const onboardingSha = getBranchCommit(onboardingBranch);
  const defaultBranchSha = getBranchCommit(defaultBranch);
  let isConflicted = false;

  if (
    onboardingCache &&
    defaultBranchSha === onboardingCache.defaultBranchSha &&
    onboardingSha === onboardingCache.onboardingBranchSha &&
    !is.undefined(onboardingCache.isConflicted)
  ) {
    return onboardingCache.isConflicted;
  } else {
    isConflicted = await scm.isBranchConflicted(
      defaultBranch,
      onboardingBranch,
    );
  }

  return isConflicted;
}
