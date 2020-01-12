import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { configFileNames } from '../../../../config/app-strings';
import { RenovateConfig } from '../../../../config';
import { REPOSITORY_DISABLED } from '../../../../constants/error-messages';

const findFile = async (fileName: string): Promise<boolean> => {
  logger.debug(`findFile(${fileName})`);
  const fileList = await platform.getFileList();
  return fileList.includes(fileName);
};

const configFileExists = async (): Promise<boolean> => {
  for (const fileName of configFileNames) {
    if (fileName !== 'package.json' && (await findFile(fileName))) {
      return true;
    }
  }
  return false;
};

const packageJsonConfigExists = async (): Promise<boolean> => {
  try {
    const pJson = JSON.parse(await platform.getFile('package.json'));
    if (pJson.renovate) {
      return true;
    }
  } catch (err) {
    // Do nothing
  }
  return false;
};

// TODO: types
export type Pr = any;

const closedPrExists = (config: RenovateConfig): Promise<Pr> =>
  platform.findPr(config.onboardingBranch, config.onboardingPrTitle, '!open');

export const isOnboarded = async (config: RenovateConfig): Promise<boolean> => {
  logger.debug('isOnboarded()');
  const title = `Action required: Add a Renovate config`;
  // Repo is onboarded if admin is bypassing onboarding and does not require a
  // configuration file.
  if (config.requireConfig === false && config.onboarding === false) {
    // Return early and avoid checking for config files
    return true;
  }
  if (await configFileExists()) {
    logger.debug('config file exists');
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
  if (config.requireConfig && config.onboarding === false) {
    throw new Error(REPOSITORY_DISABLED);
  }

  const pr = await closedPrExists(config);
  if (!pr) {
    logger.debug('Found no closed onboarding PR');
    return false;
  }
  logger.debug('Found closed onboarding PR');
  if (!config.requireConfig) {
    logger.debug('Config not mandatory so repo is considered onboarded');
    return true;
  }
  logger.info('Repo is not onboarded and no merged PRs exist');
  if (!config.suppressNotifications.includes('onboardingClose')) {
    // ensure PR comment
    await platform.ensureComment(
      pr.number,
      `Renovate is disabled`,
      `Renovate is disabled due to lack of config. If you wish to reenable it, you can either (a) commit a config file to your base branch, or (b) rename this closed PR to trigger a replacement onboarding PR.`
    );
  }
  throw new Error(REPOSITORY_DISABLED);
};

export const onboardingPrExists = async (
  config: RenovateConfig
): Promise<boolean> =>
  (await platform.getBranchPr(config.onboardingBranch)) != null;
