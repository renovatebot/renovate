const findFile = async (config, fileName) => {
  const { logger } = config;
  logger.debug('findFile()');
  logger.trace({ config });
  const fileList = await config.api.getFileList();
  return fileList.includes(fileName);
};

const renovateJsonExists = config => findFile(config, 'renovate.json');

const closedPrExists = config =>
  config.api.findPr(
    `${config.branchPrefix}configure`,
    'Configure Renovate',
    'closed'
  );

const isOnboarded = async config => {
  const { logger } = config;
  logger.debug('isOnboarded()');
  if (await renovateJsonExists(config)) {
    logger.debug('renovate.json exists');
    return true;
  }
  logger.debug('renovate.json not found');
  if (await closedPrExists(config)) {
    logger.debug('Found closed onboarding PR');
    return true;
  }
  logger.debug('Found no closed onboarding PR');
  return false;
};

const onboardingPrExists = config =>
  config.api.findPr(
    `${config.branchPrefix}configure`,
    'Configure Renovate',
    'open'
  );

module.exports = {
  isOnboarded,
  onboardingPrExists,
};
