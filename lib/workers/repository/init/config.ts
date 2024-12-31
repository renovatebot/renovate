import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../config';
import type { AllConfig, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { parseAndValidateOrExit } from '../../global/config/parse/env';
import { checkOnboardingBranch } from '../onboarding/branch';
import { mergeInheritedConfig } from './inherited';
import { mergeRenovateConfig } from './merge';

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config = await mergeInheritedConfig(config);
  config = await mergeRepoEnvConfig(config, process.env);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}

export async function mergeRepoEnvConfig(
  config: AllConfig,
  env: NodeJS.ProcessEnv,
): Promise<AllConfig> {
  const repoEnvConfig = await parseAndValidateOrExit(
    env,
    'RENOVATE_REPO_CONFIG',
  );

  if (!is.nonEmptyObject(repoEnvConfig)) {
    return config;
  }

  logger.debug({ repoEnvConfig }, 'detected repo env config');
  return mergeChildConfig(config, repoEnvConfig);
}
