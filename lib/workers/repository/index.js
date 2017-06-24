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
  let config = Object.assign({}, repoConfig);
  config.logger.trace({ config }, 'processRepo');
  try {
    config = await initApis(config);
    config = await mergeRenovateJson(config);
    const onboardingStatus = await onboarding.getOnboardingStatus(config);
    if (onboardingStatus === 'none') {
      await onboarding.onboardRepository(config);
      return;
    }
    if (onboardingStatus !== 'complete') {
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      return;
    }
    const hasConfiguredPackageFiles = config.packageFiles.length > 0;
    if (!hasConfiguredPackageFiles) {
      config = await detectPackageFiles(config);
    }
    const hasDetectedPackageFiles = config.packageFiles.length > 0;
    if (!hasDetectedPackageFiles) {
      config.logger.warn('No package files detected');
      return;
    }
    const allUpgrades = await determineRepoUpgrades(config);
    const branchUpgrades = await groupUpgradesByBranch(allUpgrades, config);
    await updateBranchesSequentially(branchUpgrades);
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
}
