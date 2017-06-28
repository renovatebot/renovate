// Workers
const branchWorker = require('../branch');
// children
const apis = require('./apis');
const onboarding = require('./onboarding');
const upgrades = require('./upgrades');

module.exports = {
  renovateRepository,
};

async function renovateRepository(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  config.logger.trace({ config }, 'renovateRepository');
  try {
    config = await apis.initApis(config);
    config = await apis.mergeRenovateJson(config);
    config.repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!config.repoIsOnboarded) {
      config = await apis.mergeRenovateJson(config, 'renovate/configure');
    }
    const hasConfiguredPackageFiles = config.packageFiles.length > 0;
    if (!hasConfiguredPackageFiles) {
      config = await apis.detectPackageFiles(config);
    }
    const allUpgrades = await upgrades.determineRepoUpgrades(config);
    const branchUpgrades = await upgrades.groupUpgradesByBranch(
      allUpgrades,
      config.logger
    );
    config.logger.trace(
      { config: branchUpgrades },
      'updateBranchesSequentially'
    );
    config.logger.debug(
      `Updating ${Object.keys(branchUpgrades).length} branch(es)`
    );
    if (config.repoIsOnboarded) {
      for (const branchName of Object.keys(branchUpgrades)) {
        await branchWorker.updateBranch(branchUpgrades[branchName]);
      }
    } else {
      await onboarding.ensurePr(config, branchUpgrades);
      config.logger.info('"Configure Renovate" PR needs to be closed first');
    }
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
}
