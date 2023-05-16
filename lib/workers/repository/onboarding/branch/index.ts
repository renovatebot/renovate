import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import { getBranchCommit, setGitAuthor } from '../../../../util/git';
import { extractAllDependencies } from '../../extract';
import { mergeRenovateConfig } from '../../init/merge';
import { OnboardingState } from '../common';
import { getOnboardingPr, isOnboarded } from './check';
import { getOnboardingConfig } from './config';
import { createOnboardingBranch } from './create';
import {
  deleteOnboardingCache,
  setOnboardingCache,
} from './onboarding-branch-cache';
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

    // delete onboarding cache
    deleteOnboardingCache();
    return { ...config, repoIsOnboarded };
  }
  if (config.isFork && config.forkProcessing !== 'enabled') {
    throw new Error(REPOSITORY_FORKED);
  }
  logger.debug('Repo is not onboarded');
  // global gitAuthor will need to be used
  setGitAuthor(config.gitAuthor);
  const onboardingPr = await getOnboardingPr(config);
  if (onboardingPr) {
    if (config.onboardingRebaseCheckbox) {
      handleOnboardingManualRebase(onboardingPr);
    }
    logger.debug('Onboarding PR already exists');
    const { rawConfigHash } = onboardingPr.bodyStruct ?? {};
    const commit = await rebaseOnboardingBranch(config, rawConfigHash);
    if (commit) {
      logger.info(
        { branch: config.onboardingBranch, commit, onboarding: true },
        'Branch updated'
      );

      // update onboarding cache
      setOnboardingCache(
        config.onboardingBranch!,
        getBranchCommit(config.defaultBranch!)!,
        commit
      );
    }
    // istanbul ignore if
    if (platform.refreshPr) {
      await platform.refreshPr(onboardingPr.number);
    }
  } else {
    logger.debug('Onboarding PR does not exist');
    const onboardingConfig = await getOnboardingConfig(config);
    let mergedConfig = mergeChildConfig(config, onboardingConfig);
    mergedConfig = await mergeRenovateConfig(mergedConfig);
    onboardingBranch = mergedConfig.onboardingBranch;

    if (
      Object.entries((await extractAllDependencies(mergedConfig)).packageFiles)
        .length === 0
    ) {
      if (!config?.onboardingNoDeps) {
        throw new Error(REPOSITORY_NO_PACKAGE_FILES);
      }
    }
    logger.debug('Need to create onboarding PR');
    if (config.onboardingRebaseCheckbox) {
      OnboardingState.prUpdateRequested = true;
    }
    const commit = await createOnboardingBranch(mergedConfig);
    // istanbul ignore if
    if (commit) {
      logger.info(
        { branch: onboardingBranch, commit, onboarding: true },
        'Branch created'
      );

      // set onboarding branch cache
      setOnboardingCache(
        config.onboardingBranch!,
        getBranchCommit(config.defaultBranch!)!,
        commit
      );
    }
  }
  if (!GlobalConfig.get('dryRun')) {
    logger.debug('Checkout onboarding branch.');
    // TODO #7154
    await scm.checkoutBranch(onboardingBranch!);
  }
  // TODO #7154
  const branchList = [onboardingBranch!];
  return { ...config, repoIsOnboarded, onboardingBranch, branchList };
}

function handleOnboardingManualRebase(onboardingPr: Pr): void {
  const pl = GlobalConfig.get('platform')!;
  const { rebaseRequested } = onboardingPr.bodyStruct ?? {};
  if (!['github', 'gitlab', 'gitea'].includes(pl)) {
    logger.trace(`Platform '${pl}' does not support extended markdown`);
    OnboardingState.prUpdateRequested = true;
  } else if (is.nullOrUndefined(rebaseRequested)) {
    logger.debug('No rebase checkbox was found in the onboarding PR');
    OnboardingState.prUpdateRequested = true;
  } else if (rebaseRequested) {
    logger.debug('Manual onboarding PR update requested');
    OnboardingState.prUpdateRequested = true;
  }
}
