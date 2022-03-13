import type { RenovateConfig } from '../../../config/types';
import { checkOnboardingBranch } from '../update/onboarding/branch';
import { mergeRenovateConfig } from './merge';
import { detectSemanticCommits } from './semantic';

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  if (config.semanticCommits === 'auto') {
    config.semanticCommits = await detectSemanticCommits();
  }
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}
