import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_FORKED,
  REPOSITORY_NO_PACKAGE_FILES,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import { getCache } from '../../../../util/cache/repository';
import { getBranchCommit, setGitAuthor } from '../../../../util/git';
import { extractAllDependencies } from '../../extract';
import { mergeRenovateConfig } from '../../init/merge';
import { OnboardingState } from '../common';
import { getOnboardingPr, isOnboarded } from './check';
import { getOnboardingConfig } from './config';
import { createOnboardingBranch } from './create';
import {
  deleteOnboardingCache,
  hasOnboardingBranchChanged,
  isOnboardingBranchConflicted,
  isOnboardingBranchModified,
  setOnboardingCache,
} from './onboarding-branch-cache';

export async function checkOnboardingBranch(
  config: RenovateConfig,
): Promise<RenovateConfig> {
  logger.debug('checkOnboarding()');
  logger.trace({ config });
  let onboardingBranch = config.onboardingBranch;
  let isConflicted = false;
  let isModified = false;
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
  // TODO #22198
  const branchList = [onboardingBranch!];
  if (onboardingPr) {
    if (config.onboardingRebaseCheckbox) {
      handleOnboardingManualRebase(onboardingPr);
    }
    logger.debug('Onboarding PR already exists');

    if (
      isConfigHashPresent(onboardingPr) && // needed so that existing onboarding PRs are updated with config hash comment
      isOnboardingCacheValid(config.defaultBranch!, config.onboardingBranch!) &&
      !(config.onboardingRebaseCheckbox && OnboardingState.prUpdateRequested)
    ) {
      logger.debug(
        'Skip processing since the onboarding branch is up to date and default branch has not changed',
      );
      OnboardingState.onboardingCacheValid = true;
      return { ...config, repoIsOnboarded, onboardingBranch, branchList };
    }
    OnboardingState.onboardingCacheValid = false;

    isModified = await isOnboardingBranchModified(config.onboardingBranch!);
    if (isModified) {
      if (hasOnboardingBranchChanged(config.onboardingBranch!)) {
        invalidateExtractCache(config.baseBranch!);
      }
      isConflicted = await isOnboardingBranchConflicted(
        config.baseBranch!,
        config.onboardingBranch!,
      );
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
        'Branch created',
      );
    }
  }
  if (!GlobalConfig.get('dryRun')) {
    // TODO #22198
    if (!isConflicted) {
      logger.debug('Merge onboarding branch in default branch');
      await scm.mergeToLocal(onboardingBranch!);
    }
  }
  setOnboardingCache(
    getBranchCommit(config.defaultBranch!)!,
    getBranchCommit(onboardingBranch!)!,
    isConflicted,
    isModified,
  );

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

function invalidateExtractCache(baseBranch: string): void {
  const cache = getCache();
  cache.scan ||= {};

  if (cache.scan?.[baseBranch]) {
    delete cache.scan[baseBranch];
  }
}

function isOnboardingCacheValid(
  defaultBranch: string,
  onboardingBranch: string,
): boolean {
  const cache = getCache();
  const onboardingBranchCache = cache?.onboardingBranchCache;
  return !!(
    onboardingBranchCache &&
    onboardingBranchCache.defaultBranchSha === getBranchCommit(defaultBranch) &&
    onboardingBranchCache.onboardingBranchSha ===
      getBranchCommit(onboardingBranch) &&
    onboardingBranchCache.configFileName &&
    onboardingBranchCache.configFileParsed
  );
}

function isConfigHashPresent(pr: Pr): boolean {
  const platform = GlobalConfig.get('platform')!;
  // if platform does not support html comments return true
  if (!['github', 'gitlab', 'gitea'].includes(platform)) {
    return true;
  }

  return !!pr.bodyStruct?.rawConfigHash;
}
