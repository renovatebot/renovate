const { detectPackageFiles } = require('../../../../manager');
const { createOnboardingBranch } = require('./create');
const { isOnboarded, onboardingPrExists } = require('./check');

async function checkOnboardingBranch(config) {
  const { logger } = config;
  logger.debug('checkOnboarding()');
  logger.trace({ config });
  const repoIsOnboarded = await isOnboarded(config);
  if (repoIsOnboarded) {
    logger.debug('Repo is onboarded');
    return { ...config, repoIsOnboarded };
  }
  if (config.isFork) {
    throw new Error('fork');
  }
  logger.info('Repo is not onboarded');
  if (!await onboardingPrExists(config)) {
    if ((await detectPackageFiles(config)).length === 0) {
      throw new Error('no-package-files');
    }
    logger.info('Need to create onboarding PR');
    await createOnboardingBranch(config);
  }
  await platform.setBaseBranch(`${config.branchPrefix}configure`);
  const branchList = [`${config.branchPrefix}configure`];
  return { ...config, repoIsOnboarded, branchList };
}

module.exports = {
  checkOnboardingBranch,
};
