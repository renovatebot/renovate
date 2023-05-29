import { configFileNames } from '../../../config/app-strings';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';

export function defaultConfigFile(config: RenovateConfig): string {
  return configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : configFileNames[0];
}

export class OnboardingState {
  private static readonly cacheKey = 'OnboardingState';
  private static readonly skipKey = 'OnboardingStateValid';
  // private static readonly onboardingConfig = 'OnboardingStateValid';

  static get prUpdateRequested(): boolean {
    const updateRequested = !!memCache.get<boolean | undefined>(
      OnboardingState.cacheKey
    );
    logger.trace(
      { value: updateRequested },
      'Get OnboardingState.prUpdateRequested'
    );
    return updateRequested;
  }

  static set prUpdateRequested(value: boolean) {
    logger.trace({ value }, 'Set OnboardingState.prUpdateRequested');
    memCache.set(OnboardingState.cacheKey, value);
  }

  static get onboardingCacheValid(): boolean {
    const validOnbaordingCache = !!memCache.get<boolean | undefined>(
      OnboardingState.skipKey
    );
    logger.trace(
      { value: validOnbaordingCache },
      'Get OnboardingState.validOnbaordingCache'
    );
    return validOnbaordingCache;
  }

  static set onboardingCacheValid(value: boolean) {
    logger.trace({ value }, 'Set OnboardingState.onboardingCacheValid');
    memCache.set(OnboardingState.skipKey, value);
  }
}
