const findFile = async fileName => {
  logger.debug(`findFile(${fileName})`);
  const fileList = await platform.getFileList();
  return fileList.includes(fileName);
};

const renovateJsonExists = async () =>
  (await findFile('renovate.json')) ||
  (await findFile('.renovaterc')) ||
  findFile('.renovaterc.json');

const packageJsonRenovateExists = async () => {
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

const closedPrExists = () =>
  platform.findPr(`renovate/configure`, 'Configure Renovate', '!open');

const isOnboarded = async config => {
  logger.debug('isOnboarded()');
  // Repo is onboarded if admin is bypassing onboarding
  if (config.onboarding === false) {
    return true;
  }
  if (await renovateJsonExists()) {
    logger.debug('renovate.json exists');
    return true;
  }
  logger.debug('renovate.json not found');
  if (await packageJsonRenovateExists()) {
    logger.debug('package.json contains renovate config');
    return true;
  }
  if (await closedPrExists(config)) {
    logger.debug('Found closed onboarding PR');
    return true;
  }
  logger.debug('Found no closed onboarding PR');
  return false;
};

const onboardingPrExists = () =>
  platform.findPr(`renovate/configure`, 'Configure Renovate', 'open');

module.exports = {
  isOnboarded,
  onboardingPrExists,
};
