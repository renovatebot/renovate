// Third party requires
const handlebars = require('handlebars');
// Config
const configParser = require('../../config');
// Workers
const branchWorker = require('../branch');
const packageFileWorker = require('../package-file');
// children
const apis = require('./apis');
const onboarding = require('./onboarding');

module.exports = {
  determineRepoUpgrades,
  groupUpgradesByBranch,
  updateBranchesSequentially,
  processRepo,
};

async function determineRepoUpgrades(config) {
  config.logger.trace({ config }, 'determineRepoUpgrades');
  if (config.packageFiles.length === 0) {
    config.logger.warn('No package files found');
  }
  let upgrades = [];
  // Iterate through repositories sequentially
  for (let index = 0; index < config.packageFiles.length; index += 1) {
    const packageFileConfig = configParser.getPackageFileConfig(config, index);
    packageFileConfig.logger.info('Renovating package file');
    upgrades = upgrades.concat(
      await packageFileWorker.processPackageFile(packageFileConfig)
    );
    packageFileConfig.logger.info('Finished repository');
  }
  return upgrades;
}

async function groupUpgradesByBranch(upgrades, logger) {
  logger.trace({ config: upgrades }, 'groupUpgradesByBranch');
  logger.info(`Processing ${upgrades.length} dependency upgrade(s)`);
  const branchUpgrades = {};
  for (const upg of upgrades) {
    const upgrade = Object.assign({}, upg);
    // Check whether to use a group name
    let branchName;
    if (upgrade.groupName) {
      upgrade.groupSlug =
        upgrade.groupSlug ||
        upgrade.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(upgrade.groupBranchName)(upgrade);
      logger.debug(
        { branchName },
        `Dependency ${upgrade.depName} is part of group '${upgrade.groupName}'`
      );
      if (branchUpgrades[branchName]) {
        upgrade.commitMessage = upgrade.groupCommitMessage;
        upgrade.prTitle = upgrade.groupPrTitle;
        upgrade.prBody = upgrade.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(upgrade.branchName)(upgrade);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [upgrade].concat(branchUpgrades[branchName]);
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  return branchUpgrades;
}

async function updateBranchesSequentially(branchUpgrades, logger) {
  logger.trace({ config: branchUpgrades }, 'updateBranchesSequentially');
  logger.debug(`Updating ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    await branchWorker.updateBranch(branchUpgrades[branchName]);
  }
}

async function processRepo(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  config.logger.trace({ config }, 'processRepo');
  try {
    config = await apis.initApis(config);
    config = await apis.mergeRenovateJson(config);
    const repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!repoIsOnboarded) {
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      return;
    }
    const hasConfiguredPackageFiles = config.packageFiles.length > 0;
    if (!hasConfiguredPackageFiles) {
      config = await apis.detectPackageFiles(config);
    }
    const allUpgrades = await module.exports.determineRepoUpgrades(config);
    const branchUpgrades = await module.exports.groupUpgradesByBranch(
      allUpgrades,
      config.logger
    );
    await updateBranchesSequentially(branchUpgrades, config.logger);
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
}
