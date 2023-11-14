import type { RenovateConfig } from '../../../config/types';
import { checkOnboardingBranch } from '../onboarding/branch';
import { mergeRenovateConfig } from './merge';

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}
