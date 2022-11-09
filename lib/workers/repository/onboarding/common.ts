import hasha from 'hasha';
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
}

export function toSha256(input: string): string {
  return hasha(input, { algorithm: 'sha256' });
}
