import { mergeChildConfig } from '../../../../config';
import { getAdminConfig } from '../../../../config/admin';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { checkoutBranch } from '../../../../util/git';
import { extractAllDependencies } from '../../extract';
import { mergeRenovateConfig } from '../../init/merge';
import { isOnboarded, onboardingPrExists } from './check';
import { getOnboardingConfig } from './config';
import { createOnboardingBranch } from './create';
import { rebaseOnboardingBranch } from './rebase';

export async function checkOnboardingBranch(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  const config = { ...config_ };
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
  logger.debug('Repo is not onboarded');
  if (await onboardingPrExists(config)) {
    logger.debug('Onboarding PR already exists');
    const commit = await rebaseOnboardingBranch(config);
    if (commit) {
      logger.info(
        { branch: config.onboardingBranch, commit, onboarding: true },
        'Branch updated'
      );
    }
    // istanbul ignore if
    if (platform.refreshPr) {
      const onboardingPr = await platform.getBranchPr(config.onboardingBranch);
      await platform.refreshPr(onboardingPr.number);
    }
  } else {
    logger.debug('Onboarding PR does not exist');
    const onboardingConfig = await getOnboardingConfig(config);
    let mergedConfig = mergeChildConfig(config, onboardingConfig);
    mergedConfig = await mergeRenovateConfig(mergedConfig);
    config.onboardingBranch = mergedConfig.onboardingBranch;

    if (
      Object.entries(await extractAllDependencies(mergedConfig)).length === 0
    ) {
      throw new Error(REPOSITORY_NO_PACKAGE_FILES);
    }
    logger.debug('Need to create onboarding PR');
    const commit = await createOnboardingBranch(mergedConfig);
    // istanbul ignore if
    if (commit) {
      logger.info(
        { branch: config.onboardingBranch, commit, onboarding: true },
        'Branch created'
      );
    }
  }
  if (!getAdminConfig().dryRun) {
    await checkoutBranch(config.onboardingBranch);
  }
  const branchList = [config.onboardingBranch];
  return { ...config, repoIsOnboarded, branchList };
}
