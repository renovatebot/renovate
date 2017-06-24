const detectPackageFiles = require('./detect-package-files');
const mergeRenovateJson = require('./merge-renovate-json');
const onboarding = require('./onboarding');
const initApis = require('./init-apis');
const getAllRepoUpgrades = require('./upgrades').getAllRepoUpgrades;
const groupUpgradesByBranch = require('./upgrades').groupUpgradesByBranch;
const processUpgrades = require('./upgrades').processUpgrades;

module.exports = {
  processRepo,
};

// Queue package files in sequence within a repo
async function processRepo(repoConfig) {
  let config = Object.assign({}, repoConfig, {
    logger: repoConfig.logger.child({ repository: repoConfig.repository }),
  });
  config.logger.info('Renovating repository');
  config.logger.debug({ config }, 'Repository config');
  try {
    config = await initApis(config);
    config = await mergeRenovateJson(config);
    const onboardingStatus = await onboarding.getOnboardingStatus(config);
    if (onboardingStatus === 'in progress') {
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      return;
    }
    if (onboardingStatus === 'none') {
      await onboarding.onboardRepository(config);
      config.logger.info('"Configure Renovate" PR has been created');
      return;
    }
    config = await detectPackageFiles(config);
    const allUpgrades = await getAllRepoUpgrades(config);
    const branchUpgrades = await groupUpgradesByBranch(allUpgrades, config);
    await processUpgrades(branchUpgrades, config);
    config.logger.info('Finished repository');
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
}
