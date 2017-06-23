module.exports = getOnboardingStatus;

async function getOnboardingStatus(config) {
  config.logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.onboarding === false) {
    config.logger.debug('Repo onboarding is disabled');
    return 'complete';
  }
  if (config.renovateOnboarded) {
    config.logger.debug('Repo onboarded');
    return 'complete';
  }
  const pr = await config.api.findPr(
    'renovate/configure',
    'Configure Renovate'
  );
  if (pr) {
    if (pr.isClosed) {
      config.logger.debug('Found closed Configure Renovate PR');
      return 'complete';
    }
    // PR exists but hasn't been closed yet
    config.logger.info(
      `PR #${pr.displayNumber} needs to be closed to enable renovate to continue`
    );
    return 'in progress';
  }
  return 'none';
}
