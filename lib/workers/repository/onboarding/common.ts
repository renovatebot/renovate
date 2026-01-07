import { isNumber } from '@sindresorhus/is';
import { getConfigFileNames } from '../../../config/app-strings';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';

export function getOnboardingAutoCloseAge(
  onboardingAutoCloseAge: number | undefined,
): number | null {
  if (!isNumber(onboardingAutoCloseAge)) {
    return null;
  }

  const onboardingAutoCloseAgeLimit = GlobalConfig.get(
    'onboardingAutoCloseAgeLimit',
  );
  if (!isNumber(onboardingAutoCloseAgeLimit)) {
    return onboardingAutoCloseAge;
  }

  if (onboardingAutoCloseAgeLimit < onboardingAutoCloseAge) {
    logger.warn(
      {
        onboardingAutoCloseAge,
        onboardingAutoCloseAgeLimit,
      },
      'Re-setting "onboardingAutoCloseAge" value to "onboardingAutoCloseAgeLimit" because it is greater than the allowed limit',
    );
    return onboardingAutoCloseAgeLimit;
  }

  return onboardingAutoCloseAge;
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
