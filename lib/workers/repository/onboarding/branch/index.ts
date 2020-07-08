import { RenovateConfig } from '../../../../config';
import {
  MANAGER_NO_PACKAGE_FILES,
  REPOSITORY_FORKED,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { extractAllDependencies } from '../../extract';
import { isOnboarded, onboardingPrExists } from './check';
import { createOnboardingBranch } from './create';
import { rebaseOnboardingBranch } from './rebase';

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
    if (Object.entries(await extractAllDependencies(config)).length === 0) {
      throw new Error(MANAGER_NO_PACKAGE_FILES);
    }
    logger.debug('Need to create onboarding PR');
    const commit = await createOnboardingBranch(config);
    // istanbul ignore if
    if (commit) {
      logger.info(
        { branch: config.onboardingBranch, commit, onboarding: true },
        'Branch created'
      );
    }
  }
  if (!config.dryRun) {
    await platform.setBaseBranch(config.onboardingBranch);
  }
  const branchList = [config.onboardingBranch];
  return { ...config, repoIsOnboarded, branchList };
}
