const { logger } = require('../../../../logger');
const { extractAllDependencies } = require('../../extract');
const { createOnboardingBranch } = require('./create');
const { rebaseOnboardingBranch } = require('./rebase');
const { isOnboarded, onboardingPrExists } = require('./check');

async function checkOnboardingBranch(input) {
  logger.debug('checkOnboarding()');
  const config = { ...input };
  config.onboardingBranch = `${config.branchPrefix}configure`;
  logger.trace({ config });
  config.repoIsOnboarded = await isOnboarded(config);
  if (config.repoIsOnboarded) {
    logger.debug('Repo is onboarded');
    return config;
  }
  if (config.isFork && !config.includeForks) {
    throw new Error('fork');
  }
  logger.info('Repo is not onboarded');
  if (await onboardingPrExists(config.onboardingBranch)) {
    logger.debug('Onboarding PR already exists');
    await rebaseOnboardingBranch(config);
  } else {
    logger.debug('Onboarding PR does not exist');
    if (Object.entries(await extractAllDependencies(config)).length === 0) {
      throw new Error('no-package-files');
    }
    logger.info('Need to create onboarding PR');
    await createOnboardingBranch(config);
  }
  if (!config.dryRun) {
    await platform.setBaseBranch(config.onboardingBranch);
  }
  config.branchList = [config.onboardingBranch];
  return config;
}

module.exports = {
  checkOnboardingBranch,
};
