const { logger } = require('../../../../logger');
const {
  appName,
  appSlug,
  configFileNames,
  onboardingPrTitle,
} = require('../../../../config/app-strings');

const findFile = async fileName => {
  logger.debug(`findFile(${fileName})`);
  const fileList = await platform.getFileList();
  return fileList.includes(fileName);
};

const configFileExists = async () => {
  for (const fileName of configFileNames) {
    if (fileName !== 'package.json' && (await findFile(fileName))) {
      return true;
    }
  }
  return false;
};

const packageJsonConfigExists = async () => {
  try {
    const pJson = JSON.parse(
      // @ts-ignore
      await platform.getFile('package.json')
    );
    if (pJson[appSlug]) {
      return true;
    }
  } catch (err) {
    // Do nothing
  }
  return false;
};

const closedPrExists = (branch, prTitle) =>
  platform.findPr(branch, prTitle, '!open');

const isOnboarded = async config => {
  logger.debug('isOnboarded()');
  const title = `Action required: Add a ${appName} config`;
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
    throw new Error('disabled');
  }

  const pr = await closedPrExists(config.onboardingBranch, onboardingPrTitle);
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
      `${appName} is disabled`,
      `${appName} is disabled due to lack of config. If you wish to reenable it, you can either (a) commit a config file to your base branch, or (b) rename this closed PR to trigger a replacement onboarding PR.`
    );
  }
  throw new Error('disabled');
};

const onboardingPrExists = onboardingBranch =>
  platform.getBranchPr(onboardingBranch);

module.exports = {
  isOnboarded,
  onboardingPrExists,
};
