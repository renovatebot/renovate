// Global requires
const handlebars = require('handlebars');
// Workers
const packageFileWorker = require('../package-file');
const branchWorker = require('../branch');

module.exports = {
  getAllRepoUpgrades,
  processUpgrades,
  removeStandaloneBranches,
};

async function getAllRepoUpgrades(config) {
  config.logger.info('getAllRepoUpgrades');
  let upgrades = [];
  for (let packageFile of config.packageFiles) {
    if (typeof packageFile === 'string') {
      packageFile = { fileName: packageFile };
    }
    const cascadedConfig = Object.assign({}, config, packageFile);
    // Remove unnecessary fields
    cascadedConfig.packageFile = cascadedConfig.fileName;
    delete cascadedConfig.fileName;
    upgrades = upgrades.concat(
      await packageFileWorker.processPackageFile(cascadedConfig)
    );
  }
  return upgrades;
}

async function processUpgrades(upgrades, config) {
  if (upgrades.length) {
    const upgradeCount = upgrades.length === 1
      ? '1 dependency upgrade'
      : `${upgrades.length} dependency upgrades`;
    config.logger.info(`Processing ${upgradeCount}`);
  } else {
    config.logger.info('No upgrades to process');
  }
  config.logger.debug({ config: upgrades }, 'All upgrades');
  const branchUpgrades = {};
  for (const upgrade of upgrades) {
    const flattened = Object.assign({}, upgrade.config, upgrade);
    delete flattened.config;
    if (flattened.upgradeType === 'pin') {
      flattened.isPin = true;
    } else if (flattened.upgradeType === 'major') {
      flattened.isMajor = true;
    } else if (flattened.upgradeType === 'minor') {
      flattened.isMinor = true;
    }
    // Check whether to use a group name
    let branchName;
    if (flattened.groupName) {
      config.logger.debug(
        `Dependency ${flattened.depName} is part of group '${flattened.groupName}'`
      );
      flattened.groupSlug =
        flattened.groupSlug ||
        flattened.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(flattened.groupBranchName)(flattened);
      config.logger.debug(`branchName=${branchName}`);
      if (branchUpgrades[branchName]) {
        // flattened.branchName = flattened.groupBranchName;
        flattened.commitMessage = flattened.groupCommitMessage;
        flattened.prTitle = flattened.groupPrTitle;
        flattened.prBody = flattened.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(flattened.branchName)(flattened);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [flattened].concat(branchUpgrades[branchName]);
  }
  config.logger.debug({ config: branchUpgrades }, 'Branched upgrades');
  for (const branch of Object.keys(branchUpgrades)) {
    await module.exports.removeStandaloneBranches(
      branchUpgrades[branch],
      config
    );
    await branchWorker.updateBranch(branchUpgrades[branch], config.logger);
  }
}

async function removeStandaloneBranches(upgrades, config) {
  if (upgrades.length > 1) {
    for (const upgrade of upgrades) {
      const standaloneBranchName = handlebars.compile(upgrade.branchName)(
        upgrade
      );
      config.logger.debug(`Need to delete branch ${standaloneBranchName}`);
      try {
        await upgrade.config.api.deleteBranch(standaloneBranchName);
      } catch (err) {
        config.logger.debug(`Couldn't delete branch ${standaloneBranchName}`);
      }
      // Rename to group branchName
      upgrade.branchName = upgrade.groupBranchName;
    }
  }
}
