const moment = require('moment');

module.exports = {
  prAlreadyExisted,
};

async function prAlreadyExisted(config) {
  logger.trace({ config }, 'prAlreadyExisted');
  if (config.recreateClosed) {
    logger.debug('recreateClosed is true');
    return null;
  }
  logger.debug('recreateClosed is false');
  // Return if same PR already existed
  // Check for current PR title format
  let pr = await platform.findPr(config.branchName, config.prTitle, 'closed');
  if (pr) {
    logger.debug('Found closed PR with current title');
    // this code exists to ignore mistakenly closed PRs which occurred due to a bug
    // TODO: Remove this by end of June 2018
    const closedAt = moment(pr.closed_at);
    const problemStart = moment('2017-10-15T20:00:00Z');
    const problemStopped = moment('2017-10-16T06:00:00Z');
    if (problemStart.isBefore(closedAt) && closedAt.isBefore(problemStopped)) {
      logger.info(
        { closedAt, problemStart, problemStopped },
        'Renaming mistakenly closed PR'
      );
      await platform.updatePr(pr.number, `${pr.title} - autoclosed`);
      return null;
    }
    return pr;
  }
  // Check for legacy PR title format
  // TODO: remove this once not found anymore
  const legacyPrTitle = config.prTitle
    .replace(/to v(\d+)$/, 'to version $1.x') // Major
    .replace(/to v(\d+)/, 'to version $1'); // Non-major
  pr = await platform.findPr(config.branchName, legacyPrTitle, 'closed');
  if (pr) {
    logger.info('Found closed PR with legacy title');
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
