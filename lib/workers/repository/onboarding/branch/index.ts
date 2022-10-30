import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import {
  checkoutBranch,
  getBranchCommit,
  setGitAuthor,
} from '../../../../util/git';
import {
  setOnboardingBranchCache,
  validateAndRetrieveOnboardingCache,
} from '../../../../util/git/onboarding-branch-cache';
import { extractAllDependencies } from '../../extract';
import { mergeRenovateConfig } from '../../init/merge';
import { getOnboardingPr, isOnboarded } from './check';
import { getOnboardingConfig } from './config';
import { createOnboardingBranch } from './create';
import { rebaseOnboardingBranch } from './rebase';

export async function checkOnboardingBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkOnboarding()');
  logger.trace({ config });
  let onboardingBranch = config.onboardingBranch;
  let repoIsOnboarded: boolean;
  // TODO #7154
  const baseBranchSha = getBranchCommit(config.defaultBranch!);
  // TODO #7154
  const onboardingCache = validateAndRetrieveOnboardingCache(
    baseBranchSha!,
    config.defaultBranch!
  );
  if (onboardingCache === null) {
    repoIsOnboarded = await isOnboarded(config);
  } /* istanbul ignore next*/ else {
    logger.debug('Using cached result for isOnboarded');
    repoIsOnboarded = false;
  }
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
  const onboardingPr = await getOnboardingPr(config);
  if (onboardingPr) {
    logger.debug('Onboarding PR already exists');
    if (onboardingCache === null) {
      const { commit, configFile, contents } = await rebaseOnboardingBranch(
        config
      );
      if (commit) {
        logger.info(
          { branch: config.onboardingBranch, commit, onboarding: true },
          'Branch updated'
        );
        // TODO #7154
        setOnboardingBranchCache(
          commit,
          baseBranchSha!,
          false,
          configFile!,
          contents!
        );
      }
    }
    // istanbul ignore if
    if (platform.refreshPr) {
      // TODO #7154
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
    const {
      commit,
      configFile: file,
      contents,
    } = await createOnboardingBranch(mergedConfig);
    // istanbul ignore if
    if (commit) {
      logger.info(
        { branch: onboardingBranch, commit, onboarding: true },
        'Branch created'
      );
      // TODO #7154
      setOnboardingBranchCache(commit, baseBranchSha!, false, file!, contents!);
    }
  }
  if (!GlobalConfig.get('dryRun') && onboardingCache === null) {
    logger.debug('Checkout onboarding branch.');
    // TODO #7154
    await checkoutBranch(onboardingBranch!);
  }
  // TODO #7154
  const branchList = [onboardingBranch!];
  return { ...config, repoIsOnboarded, onboardingBranch, branchList };
}
