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
  const pr = await platform.findPr(config.branchName, config.prTitle, '!open');
  if (pr) {
    logger.debug('Found closed PR with current title');
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
