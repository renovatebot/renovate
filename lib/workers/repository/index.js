// Workers
const branchWorker = require('../branch');
// children
const apis = require('./apis');
const onboarding = require('./onboarding');
const upgrades = require('./upgrades');
const cleanup = require('./cleanup');

module.exports = {
  renovateRepository,
};

async function renovateRepository(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  config.errors = [];
  config.warnings = [];
  config.logger.trace({ config }, 'renovateRepository');
  try {
    config = await apis.initApis(config);
    config = await apis.mergeRenovateJson(config);
    if (config.enabled === false) {
      config.logger.debug('repository is disabled');
      return;
    }
    if (config.packageFiles.length === 0) {
      config.logger.debug('Detecting package files');
      config = await apis.detectPackageFiles(config);
      if (config.packageFiles.length === 0) {
        if (!config.hasRenovateJson) {
          config.logger.debug('Checking if repository has a package.json');
          const pJson = await config.api.getFileJson('package.json');
          if (!pJson) {
            config.logger.info('Repository has no package.json');
            return;
          }
        }
        config.packageFiles.push('package.json');
      }
    }
    config.repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!config.repoIsOnboarded) {
      const packageFiles = config.packageFiles;
      config = await apis.mergeRenovateJson(config, 'renovate/configure');
      if (config.packageFiles.length === 0) {
        config.packageFiles = packageFiles;
      }
    }
    const allUpgrades = await upgrades.determineRepoUpgrades(config);
    const res = await upgrades.branchifyUpgrades(allUpgrades, config.logger);
    config.errors = config.errors.concat(res.errors);
    config.warnings = config.warnings.concat(res.warnings);
    const branchUpgrades = res.branchUpgrades;
    config.logger.debug(
      `Updating ${Object.keys(branchUpgrades).length} branch(es)`
    );
    config.logger.trace({ config: branchUpgrades }, 'branchUpgrades');
    if (config.repoIsOnboarded) {
      const branchList = [];
      for (const branchName of Object.keys(branchUpgrades)) {
        const createdBranchName = await branchWorker.processBranchUpgrades(
          branchUpgrades[branchName],
          config.errors,
          config.warnings
        );
        if (createdBranchName) {
          branchList.push(createdBranchName);
        }
      }
      await cleanup.pruneStaleBranches(config, branchList);
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
