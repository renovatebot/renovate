const handlebars = require('handlebars');
const configParser = require('../../config');
const packageFileWorker = require('../package-file');

module.exports = {
  determineRepoUpgrades,
  groupUpgradesByBranch,
  getPackageFileConfig,
};

async function determineRepoUpgrades(config) {
  config.logger.trace({ config }, 'determineRepoUpgrades');
  if (config.packageFiles.length === 0) {
    config.logger.warn('No package files found');
  }
  let upgrades = [];
  // Iterate through repositories sequentially
  for (let index = 0; index < config.packageFiles.length; index += 1) {
    const packageFileConfig = module.exports.getPackageFileConfig(
      config,
      index
    );
    upgrades = upgrades.concat(
      await packageFileWorker.findUpgrades(packageFileConfig)
    );
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

function getPackageFileConfig(repoConfig, index) {
  let packageFile = repoConfig.packageFiles[index];
  if (typeof packageFile === 'string') {
    packageFile = { packageFile };
  } else if (packageFile.fileName) {
    // Retained deprecated 'fileName' for backwards compatibility
    // TODO: Remove in renovate 9
    packageFile.packageFile = packageFile.fileName;
    delete packageFile.fileName;
  }
  const packageFileConfig = Object.assign({}, repoConfig, packageFile);
  repoConfig.logger.trace({ config: repoConfig }, 'repoConfig');
  packageFileConfig.logger = packageFileConfig.logger.child({
    repository: packageFileConfig.repository,
    packageFile: packageFileConfig.packageFile,
  });
  packageFileConfig.logger.trace(
    { config: packageFileConfig },
    'packageFileConfig'
  );
  return configParser.filterConfig(packageFileConfig, 'packageFile');
}
