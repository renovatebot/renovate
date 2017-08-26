module.exports = {
  prAlreadyExisted,
};

async function prAlreadyExisted(config) {
  const { logger } = config;
  logger.trace({ config }, 'prAlreadyExisted');
  if (config.recreateClosed) {
    logger.debug('recreateClosed is true');
    return false;
  }
  logger.debug('recreateClosed is false');
  // Return if same PR already existed
  // Check for current PR title format
  if (await config.api.checkForClosedPr(config.branchName, config.prTitle)) {
    logger.debug('Found closed PR with current title');
    return true;
  }
  // Check for legacy PR title format
  // TODO: remove this in v10
  const legacyPrTitle = config.prTitle
    .replace(/to v(\d+)$/, 'to version $1.x') // Major
    .replace(/to v(\d+)/, 'to version $1'); // Non-major
  if (await config.api.checkForClosedPr(config.branchName, legacyPrTitle)) {
    logger.debug('Found closed PR with legacy title');
    return true;
  }
  logger.debug('prAlreadyExisted=false');
  return false;
}
