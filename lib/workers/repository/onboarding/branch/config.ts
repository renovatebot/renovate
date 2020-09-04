import { RenovateConfig, RenovateSharedConfig } from '../../../../config';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';

function getSemanticCommitsValue(
  config: RenovateConfig,
  onboardingConfig: RenovateSharedConfig
): boolean {
  if (typeof onboardingConfig.semanticCommits !== 'boolean') {
    return typeof config.semanticCommits === 'boolean'
      ? config.semanticCommits
      : false;
  }
  return onboardingConfig.semanticCommits;
}

export function getOnboardingConfig(config: RenovateConfig): string {
  const onboardingConfig = clone(config.onboardingConfig);
  onboardingConfig.semanticCommits = getSemanticCommitsValue(
    config,
    onboardingConfig
  );
  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
