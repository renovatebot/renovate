import { RenovateConfig } from '../../../../config';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';

export function getOnboardingConfig(config: RenovateConfig): string {
  const onboardingConfig = clone(config.onboardingConfig);
  if (
    typeof onboardingConfig.semanticCommits === 'undefined' &&
    typeof config.semanticCommits === 'boolean'
  ) {
    onboardingConfig.semanticCommits = config.semanticCommits;
  }
  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
