import { configFileNames } from '../../../../config/app-strings';
import type { RenovateConfig } from '../../../../config/types';
import {
  REPOSITORY_CLOSED_ONBOARDING,
  REPOSITORY_NO_CONFIG,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import { getCache } from '../../../../util/cache/repository';
import { readLocalFile } from '../../../../util/fs';
import { getFileList } from '../../../../util/git';

async function findFile(fileName: string): Promise<boolean> {
  logger.debug(`findFile(${fileName})`);
  const fileList = await getFileList();
  return fileList.includes(fileName);
}

async function configFileExists(): Promise<boolean> {
  for (const fileName of configFileNames) {
    if (fileName !== 'package.json' && (await findFile(fileName))) {
      logger.debug(`Config file exists, fileName: ${fileName}`);
      return true;
    }
  }
  return false;
}

async function packageJsonConfigExists(): Promise<boolean> {
  try {
    // TODO #7154
    const pJson = JSON.parse((await readLocalFile('package.json', 'utf8'))!);
    if (pJson.renovate) {
      return true;
    }
  } catch (err) {
    // Do nothing
  }
  return false;
}

function closedPrExists(config: RenovateConfig): Promise<Pr | null> {
  return platform.findPr({
    branchName: config.onboardingBranch!,
    prTitle: config.onboardingPrTitle,
    state: '!open',
  });
}

export async function isOnboarded(config: RenovateConfig): Promise<boolean> {
  logger.debug('isOnboarded()');
  const title = `Action required: Add a Renovate config`;
  // Repo is onboarded if global config is bypassing onboarding and does not require a
  // configuration file.
  if (config.requireConfig === 'optional' && config.onboarding === false) {
    // Return early and avoid checking for config files
    return true;
  }
  if (config.requireConfig === 'ignored') {
    logger.debug('Config file will be ignored');
    return true;
  }
  const cache = getCache();
  if (cache.configFileName) {
    logger.debug('Checking cached config file name');
    try {
      const configFileContent = await platform.getJsonFile(
        cache.configFileName
      );
      if (configFileContent) {
        if (
          cache.configFileName !== 'package.json' ||
          configFileContent.renovate
        ) {
          logger.debug('Existing config file confirmed');
          logger.debug(
            { fileName: cache.configFileName, config: configFileContent },
            'Repository config'
          );
          return true;
        }
      }
    } catch (err) {
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

  const pr = await closedPrExists(config);
  if (!pr) {
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
    // ensure PR comment
    await ensureComment({
      number: pr.number,
      topic: `Renovate is disabled`,
      content: `Renovate is disabled due to lack of config. If you wish to reenable it, you can either (a) commit a config file to your base branch, or (b) rename this closed PR to trigger a replacement onboarding PR.`,
    });
  }
  throw new Error(REPOSITORY_CLOSED_ONBOARDING);
}

export async function getOnboardingPr(
  config: RenovateConfig
): Promise<Pr | null> {
  return await platform.getBranchPr(config.onboardingBranch!);
}
