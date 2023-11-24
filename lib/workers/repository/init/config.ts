import {
  currentRenovateCompatibility,
  mergeCompatibilityConfig,
  resolveCompatibilityVersion,
} from '../../../config/compatibility';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { checkOnboardingBranch } from '../onboarding/branch';
import { mergeRenovateConfig } from './merge';

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config = await checkOnboardingBranch(config);
  const repoConfig = await mergeRenovateConfig(config);
  const renovateCompatibility = resolveCompatibilityVersion(
    repoConfig.renovateCompatibility,
  );
  if (renovateCompatibility === currentRenovateCompatibility) {
    logger.debug('No compatibility preset needed');
    return repoConfig;
  }
  // Repo needs compatibility presets
  config = await mergeCompatibilityConfig(config, renovateCompatibility);
  return mergeRenovateConfig(config);
}
