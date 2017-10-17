const moment = require('moment');

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
  const pr = config.api.findPr(config.branchName, config.prTitle, 'closed');
  if (pr) {
    logger.debug('Found closed PR with current title');
    // this code exists to ignore mistakenly closed PRs which occurred due to a bug
    // TODO: Remove this by end of October 2017 or in v10
    const closedAt = moment(pr.closed_at);
    const problemStart = moment('2017-10-15T20:00:00Z');
    const problemStopped = moment('2017-10-16T06:00:00Z');
    if (problemStart.isBefore(closedAt) && closedAt.isBefore(problemStopped)) {
      logger.info(
        { closedAt, problemStart, problemStopped },
        'Ignoring mistakenly closed PR'
      );
      return false;
    }
    return true;
  }
  // Check for legacy PR title format
  // TODO: remove this in v10
  const legacyPrTitle = config.prTitle
    .replace(/to v(\d+)$/, 'to version $1.x') // Major
    .replace(/to v(\d+)/, 'to version $1'); // Non-major
  if (await config.api.findPr(config.branchName, legacyPrTitle, 'closed')) {
    logger.debug('Found closed PR with legacy title');
    return true;
  }
  logger.debug('prAlreadyExisted=false');
  return false;
}
