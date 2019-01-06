const {
  appName,
  appSlug,
  configFileNames,
  onboardingBranch,
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
    const pJson = JSON.parse(await platform.getFile('package.json'));
    if (pJson[appSlug]) {
      return true;
    }
  } catch (err) {
    // Do nothing
  }
  return false;
};

const closedPrExists = () =>
  platform.findPr(onboardingBranch, onboardingPrTitle, '!open');

const isOnboarded = async config => {
  logger.debug('isOnboarded()');
  // Repo is onboarded if admin is bypassing onboarding
  if (config.onboarding === false) {
    return true;
  }
  if (await configFileExists()) {
    logger.debug('config file exists');
    return true;
  }
  logger.debug('config file not found');
  if (await packageJsonConfigExists()) {
    logger.debug('package.json contains config');
    return true;
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
  const mergedPrExists = (await platform.getPrList()).some(
    p => p.state === 'merged' && p.branchName.startsWith(config.branchPrefix)
  );
  if (mergedPrExists) {
    logger.info(
      'Repo is not onboarded but at least one merged PR exists - treat as onboarded'
    );
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

const onboardingPrExists = () => platform.getBranchPr(onboardingBranch);

module.exports = {
  isOnboarded,
  onboardingPrExists,
};
