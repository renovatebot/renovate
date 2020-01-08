import { logger } from '../../../../logger';
import { extractAllDependencies } from '../../extract';
import { createOnboardingBranch } from './create';
import { rebaseOnboardingBranch } from './rebase';
import { isOnboarded, onboardingPrExists } from './check';
import { RenovateConfig } from '../../../../config';
import { platform } from '../../../../platform';
import {
  MANAGER_NO_PACKAGE_FILES,
  REPOSITORY_FORKED,
} from '../../../../constants/error-messages';

export async function checkOnboardingBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkOnboarding()');
  logger.trace({ config });
  const repoIsOnboarded = await isOnboarded(config);
  if (repoIsOnboarded) {
    logger.debug('Repo is onboarded');
    return { ...config, repoIsOnboarded };
  }
  if (config.isFork && !config.includeForks) {
    throw new Error(REPOSITORY_FORKED);
  }
  logger.info('Repo is not onboarded');
  if (await onboardingPrExists(config)) {
    logger.debug('Onboarding PR already exists');
    await rebaseOnboardingBranch(config);
  } else {
    logger.debug('Onboarding PR does not exist');
    if (Object.entries(await extractAllDependencies(config)).length === 0) {
      throw new Error(MANAGER_NO_PACKAGE_FILES);
    }
    logger.info('Need to create onboarding PR');
    await createOnboardingBranch(config);
  }
  if (!config.dryRun) {
    await platform.setBaseBranch(config.onboardingBranch);
  }
  const branchList = [config.onboardingBranch];
  return { ...config, repoIsOnboarded, branchList };
}
