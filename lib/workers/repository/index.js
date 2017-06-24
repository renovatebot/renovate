const logger = require('../../helpers/logger');
// Child functions
const detectPackageFiles = require('./detect-package-files');
const mergeRenovateJson = require('./merge-renovate-json');
const onboarding = require('./onboarding');
const initApis = require('./init-apis');
const determineRepoUpgrades = require('./determine-repo-upgrades');
const groupUpgradesByBranch = require('./group-upgrades-by-branch');
const updateBranchesSequentially = require('./update-branches-sequentially');

module.exports = {
  processRepo,
};

// Queue package files in sequence within a repo
async function processRepo(repoConfig) {
  let config = Object.assign({}, repoConfig, {
    logger: logger.child({ repository: repoConfig.repository }),
  });
  config.logger.info('Renovating repository');
  config.logger.trace({ config }, 'Repository config');
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
    if (!config.packageFiles.length) {
      config = await detectPackageFiles(config);
    }
    const allUpgrades = await determineRepoUpgrades(config);
    const branchUpgrades = await groupUpgradesByBranch(allUpgrades, config);
    await updateBranchesSequentially(branchUpgrades);
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
  config.logger.info('Finished repository');
}
