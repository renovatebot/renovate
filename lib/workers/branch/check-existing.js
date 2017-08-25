module.exports = {
  prAlreadyExisted,
};

async function prAlreadyExisted(config) {
  if (config.recreateClosed) {
    return false;
  }
  // Return if same PR already existed
  // Check for current PR title format
  if (await config.api.checkForClosedPr(config.branchName, config.prTitle)) {
    return true;
  }
  // Check for legacy PR title format
  // TODO: remove this in v10
  const legacyPrTitle = config.prTitle
    .replace(/to v(\d+)$/, 'to version $1.x') // Major
    .replace(/to v(\d+)/, 'to version $1'); // Non-major
  if (await config.api.checkForClosedPr(config.branchName, legacyPrTitle)) {
    return true;
  }
  return false;
}
