import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { checkoutBranch, setGitAuthor } from '../../../../util/git';
import { extractAllDependencies } from '../../extract';
import { mergeRenovateConfig } from '../../init/merge';
import { isOnboarded, onboardingPrExists } from './check';
import { getOnboardingConfig } from './config';
import { createOnboardingBranch } from './create';
import { rebaseOnboardingBranch } from './rebase';

export async function checkOnboardingBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkOnboarding()');
  logger.trace({ config });
  let onboardingBranch = config.onboardingBranch;
  const repoIsOnboarded = await isOnboarded(config);
  if (repoIsOnboarded) {
    logger.debug('Repo is onboarded');
    return { ...config, repoIsOnboarded };
  }
  if (config.isFork && !config.includeForks) {
    throw new Error(REPOSITORY_FORKED);
  }
  logger.debug('Repo is not onboarded');
  // global gitAuthor will need to be used
  setGitAuthor(config.gitAuthor);
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
    onboardingBranch = mergedConfig.onboardingBranch;

    if (
      Object.entries(await extractAllDependencies(mergedConfig)).length === 0
    ) {
      if (!config?.onboardingNoDeps) {
        throw new Error(REPOSITORY_NO_PACKAGE_FILES);
      }
    }
    logger.debug('Need to create onboarding PR');
    const commit = await createOnboardingBranch(mergedConfig);
    // istanbul ignore if
    if (commit) {
      logger.info(
        { branch: onboardingBranch, commit, onboarding: true },
        'Branch created'
      );
    }
  }
  if (!GlobalConfig.get('dryRun')) {
    await checkoutBranch(onboardingBranch);
  }
  const branchList = [onboardingBranch];
  return { ...config, repoIsOnboarded, onboardingBranch, branchList };
}
