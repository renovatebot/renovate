import { isNumber } from '@sindresorhus/is';
import { getConfigFileNames } from '../../../config/app-strings';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';

export function getOnboardingAutoCloseAge(
  inheritedOnboardingAutoCloseAge: number | undefined,
): number | null {
  const globalOnboardingAutoCloseAge = GlobalConfig.get(
    'onboardingAutoCloseAge',
  )!;

  if (
    !isNumber(inheritedOnboardingAutoCloseAge) &&
    !isNumber(globalOnboardingAutoCloseAge)
  ) {
    return null;
  }

  if (!isNumber(inheritedOnboardingAutoCloseAge)) {
    return globalOnboardingAutoCloseAge;
  }

  if (!isNumber(globalOnboardingAutoCloseAge)) {
    return inheritedOnboardingAutoCloseAge;
  }

  if (globalOnboardingAutoCloseAge < inheritedOnboardingAutoCloseAge) {
    logger.warn(
      {
        inheritedOnboardingAutoCloseAge,
        globalOnboardingAutoCloseAge,
      },
      'Re-setting "onboardingAutoCloseAge" value as it crosses the global limit',
    );
    return globalOnboardingAutoCloseAge;
  }

  return inheritedOnboardingAutoCloseAge;
}

export function getSemanticCommitPrTitle(config: RenovateConfig): string {
  return `${config.semanticCommitType ?? 'chore'}: ${config.onboardingPrTitle}`;
}

export function getDefaultConfigFileName(config: RenovateConfig): string {
  const configFileNames = getConfigFileNames();
  return configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : configFileNames[0];
}

export class OnboardingState {
  private static readonly cacheKey = 'OnboardingState';
  private static readonly skipKey = 'OnboardingStateValid';

  static get prUpdateRequested(): boolean {
    const updateRequested = !!memCache.get<boolean | undefined>(
      OnboardingState.cacheKey,
    );
    logger.trace(
      { value: updateRequested },
      'Get OnboardingState.prUpdateRequested',
    );
    return updateRequested;
  }

  static set prUpdateRequested(value: boolean) {
    logger.trace({ value }, 'Set OnboardingState.prUpdateRequested');
    memCache.set(OnboardingState.cacheKey, value);
  }

  static get onboardingCacheValid(): boolean {
    const cacheValid = !!memCache.get<boolean | undefined>(
      OnboardingState.skipKey,
    );
    logger.trace(
      { value: cacheValid },
      'Get OnboardingState.onboardingCacheValid',
    );
    return cacheValid;
  }

  static set onboardingCacheValid(value: boolean) {
    logger.trace({ value }, 'Set OnboardingState.onboardingCacheValid');
    memCache.set(OnboardingState.skipKey, value);
  }
}
