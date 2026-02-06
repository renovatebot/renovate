import { isNonEmptyObject } from '@sindresorhus/is';
import { getConfigFileNames } from '../../../../config/app-strings.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import {
  REPOSITORY_CLOSED_ONBOARDING,
  REPOSITORY_NO_CONFIG,
} from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { ensureComment } from '../../../../modules/platform/comment.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { getCache } from '../../../../util/cache/repository/index.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { getElapsedDays } from '../../../../util/date.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { getBranchCommit } from '../../../../util/git/index.ts';
import { getSemanticCommitPrTitle } from '../common.ts';

async function findFile(fileName: string): Promise<boolean> {
  logger.debug(`findFile(${fileName})`);
  const fileList = await scm.getFileList();
  return fileList.includes(fileName);
}

async function configFileExists(): Promise<boolean> {
  for (const fileName of getConfigFileNames()) {
    if (fileName !== 'package.json' && (await findFile(fileName))) {
      logger.debug(`Config file exists, fileName: ${fileName}`);
      return true;
    }
  }
  return false;
}

async function packageJsonConfigExists(): Promise<boolean> {
  try {
    // TODO #22198
    const pJson = JSON.parse((await readLocalFile('package.json', 'utf8'))!);
    if (pJson.renovate) {
      return true;
    }
  } catch {
    // Do nothing
  }
  return false;
}

async function closedPrExists(config: RenovateConfig): Promise<Pr | null> {
  return (
    (await platform.findPr({
      branchName: getInheritedOrGlobal('onboardingBranch')!,
      prTitle: config.onboardingPrTitle,
      state: '!open',
      targetBranch: config.baseBranch,
    })) ??
    (await platform.findPr({
      branchName: getInheritedOrGlobal('onboardingBranch')!,
      prTitle: getSemanticCommitPrTitle(config),
      state: '!open',
      targetBranch: config.baseBranch,
    }))
  );
}

export async function isOnboarded(config: RenovateConfig): Promise<boolean> {
  logger.debug('isOnboarded()');
  const title = `Action required: Add a Renovate config`;

  // Repo is onboarded if in silent mode
  if (config.mode === 'silent') {
    logger.debug('Silent mode enabled so repo is considered onboarded');
    return true;
  }

  // Repo is onboarded if global config is bypassing onboarding and does not require a
  // configuration file.
  // The repo is considered "not onboarded" if:
  // - An onboarding cache is present, and
  // - The current default branch SHA matches the default SHA found in the cache
  // Also if there is a closed pr skip using cache as it is outdated
  if (config.requireConfig === 'optional' && config.onboarding === false) {
    // Return early and avoid checking for config files
    return true;
  }
  if (config.requireConfig === 'ignored') {
    logger.debug('Config file will be ignored');
    return true;
  }

  const closedOnboardingPr = await closedPrExists(config);
  const cache = getCache();
  const onboardingBranchCache = cache?.onboardingBranchCache;
  // if onboarding cache is present and base branch has not been updated; branch is not onboarded
  // if closed pr exists then presence of onboarding cache doesn't matter as we need to skip onboarding
  if (
    config.onboarding &&
    !closedOnboardingPr &&
    isNonEmptyObject(onboardingBranchCache) &&
    onboardingBranchCache.defaultBranchSha ===
      getBranchCommit(config.defaultBranch!)
  ) {
    logger.debug('Onboarding cache is valid. Repo is not onboarded');
    return false;
  }

  // when bot is ran is fork mode ... do not fetch file using api call instead use the git.fileList so we get sync first and get the latest config
  // prevents https://github.com/renovatebot/renovate/discussions/37328
  if (cache.configFileName && !config.forkToken) {
    logger.debug('Checking cached config file name');
    try {
      const configFileContent = await platform.getJsonFile(
        cache.configFileName,
      );
      if (configFileContent) {
        if (
          cache.configFileName !== 'package.json' ||
          configFileContent.renovate
        ) {
          logger.debug('Existing config file confirmed');
          logger.debug(
            { fileName: cache.configFileName, config: configFileContent },
            'Repository config',
          );
          return true;
        }
      }
    } catch {
      // probably file doesn't exist
    }
    logger.debug('Existing config file no longer exists');
    delete cache.configFileName;
  }
  if (await configFileExists()) {
    await platform.ensureIssueClosing(title);
    return true;
  }
  logger.debug('config file not found');
  if (await packageJsonConfigExists()) {
    logger.debug('package.json contains config');
    await platform.ensureIssueClosing(title);
    return true;
  }

  // If onboarding has been disabled and config files are required then the
  // repository has not been onboarded yet
  if (config.requireConfig === 'required' && config.onboarding === false) {
    throw new Error(REPOSITORY_NO_CONFIG);
  }

  if (!closedOnboardingPr) {
    logger.debug('Found no closed onboarding PR');
    return false;
  }
  logger.debug('Found closed onboarding PR');
  if (config.requireConfig === 'optional') {
    logger.debug('Config not mandatory so repo is considered onboarded');
    return true;
  }
  logger.debug('Repo is not onboarded and no merged PRs exist');
  if (!config.suppressNotifications!.includes('onboardingClose')) {
    const ageOfOnboardingPr = getElapsedDays(
      closedOnboardingPr.createdAt!,
      false,
    );
    const onboardingAutoCloseAge = getInheritedOrGlobal(
      'onboardingAutoCloseAge',
    );
    if (onboardingAutoCloseAge) {
      logger.debug(
        {
          onboardingAutoCloseAge,
          createdAt: closedOnboardingPr.createdAt!,
          ageOfOnboardingPr,
        },
        `Determining that the closed onboarding PR was created at \`${closedOnboardingPr.createdAt!}\` was created ${ageOfOnboardingPr.toFixed(2)} days ago`,
      );
    }
    // if we have onboardingAutoCloseAge, and it hasn't yet passed onboardingAutoCloseAge, add a comment
    // if it /has/ passed, we'll comment this appropriately in `ensureOnboardingPr`, so there doesn't need to be a comment here
    if (
      !onboardingAutoCloseAge ||
      ageOfOnboardingPr <= onboardingAutoCloseAge
    ) {
      // ensure PR comment
      await ensureComment({
        number: closedOnboardingPr.number,
        topic: `Renovate is disabled`,
        content: `Renovate is disabled because there is no Renovate configuration file. To enable Renovate, you can either (a) change this PR's title to get a new onboarding PR, and merge the new onboarding PR, or (b) create a Renovate config file, and commit that file to your base branch.`,
      });
    }
  }
  throw new Error(REPOSITORY_CLOSED_ONBOARDING);
}

export async function getOnboardingPr(
  config: RenovateConfig,
): Promise<Pr | null> {
  return await platform.getBranchPr(
    getInheritedOrGlobal('onboardingBranch')!,
    config.baseBranch,
  );
}
