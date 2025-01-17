import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../config';
import type { AllConfig, RenovateConfig } from '../../../config/types';
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
  config = await mergeStaticRepoEnvConfig(config, process.env);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}

export async function mergeStaticRepoEnvConfig(
  config: AllConfig,
  env: NodeJS.ProcessEnv,
): Promise<AllConfig> {
  const repoEnvConfig = await parseAndValidateOrExit(
    env,
    'RENOVATE_STATIC_REPO_CONFIG',
  );

  if (!is.nonEmptyObject(repoEnvConfig)) {
    return config;
  }

  return mergeChildConfig(config, repoEnvConfig);
}
