import { RenovateConfig } from '../../../../config';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';

export function getOnboardingConfig(config: RenovateConfig): string {
  const onboardingConfig = clone(config.onboardingConfig);
  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
