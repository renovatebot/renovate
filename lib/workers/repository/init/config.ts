import type { RenovateConfig } from '../../../config/types.ts';
import { checkOnboardingBranch } from '../onboarding/branch/index.ts';
import { mergeInheritedConfig } from './inherited.ts';
import { mergeRenovateConfig } from './merge.ts';

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config = await mergeInheritedConfig(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}
