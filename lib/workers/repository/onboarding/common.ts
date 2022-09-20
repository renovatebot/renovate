import hasha from 'hasha';
import { configFileNames } from '../../../config/app-strings';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';

export function defaultConfigFile(config: RenovateConfig): string {
  return configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : configFileNames[0];
}

export class OnboardingState {
  private static updateRequested = false;

  static get prUpdateRequested(): boolean {
    logger.trace(
      { value: this.updateRequested },
      'Get OnboardingState.prUpdateRequested'
    );
    return this.updateRequested;
  }

  static set prUpdateRequested(value: boolean) {
    logger.trace({ value }, 'Set OnboardingState.prUpdateRequested');
    this.updateRequested = value;
  }
}

export function toSha256(input: string): string {
  return hasha(input, { algorithm: 'sha256' });
}
