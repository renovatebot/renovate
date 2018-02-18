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
  // See #1205 for why we check for !open or closed
  const statusValue =
    config.packageFiles && config.packageFiles.length === 1
      ? '!open'
      : 'closed';
  let pr = await platform.findPr(
    config.branchName,
    config.prTitle,
    statusValue
  );
  if (pr) {
    logger.debug('Found closed PR with current title');
    return pr;
  }
  // Check for legacy PR title format
  // TODO: remove this once not found anymore
  const legacyPrTitle = config.prTitle
    .replace(/to v(\d+)$/, 'to version $1.x') // Major
    .replace(/to v(\d+)/, 'to version $1'); // Non-major
  pr = await platform.findPr(config.branchName, legacyPrTitle, statusValue);
  if (pr) {
    logger.info({ pr }, 'Found closed PR with legacy title');
    await platform.updatePr(pr.number, config.prTitle);
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
