const handlebars = require('handlebars');
const configParser = require('../../config');
const packageFileWorker = require('../package-file');

module.exports = {
  determineRepoUpgrades,
  branchifyUpgrades,
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

async function branchifyUpgrades(upgrades, logger) {
  logger.trace({ config: upgrades }, 'branchifyUpgrades');
  logger.info(`Processing ${upgrades.length} dependency upgrade(s)`);
  const result = {
    errors: [],
    warnings: [],
    branchUpgrades: {},
  };
  for (const upg of upgrades) {
    const upgrade = Object.assign({}, upg);
    // Split out errors and wrnings first
    if (upgrade.type === 'error') {
      result.errors.push(upgrade);
    } else if (upgrade.type === 'warning') {
      result.warnings.push(upgrade);
    } else {
      // Check whether to use a group name
      let branchName;
      if (upgrade.groupName) {
        // if groupName is defined then use group branchName template for combining
        logger.debug(
          { branch: branchName },
          `Dependency ${upgrade.depName} is part of group '${upgrade.groupName}'`
        );
        upgrade.groupSlug =
          upgrade.groupSlug ||
          upgrade.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
        branchName = handlebars.compile(upgrade.group.branchName)(upgrade);
      } else {
        // Use regular branchName template
        branchName = handlebars.compile(upgrade.branchName)(upgrade);
      }
      result.branchUpgrades[branchName] =
        result.branchUpgrades[branchName] || [];
      result.branchUpgrades[branchName] = [upgrade].concat(
        result.branchUpgrades[branchName]
      );
    }
  }
  logger.debug(
    `Returning ${Object.keys(result.branchUpgrades).length} branch(es)`
  );
  return result;
}

function getPackageFileConfig(repoConfig, index) {
  let packageFile = repoConfig.packageFiles[index];
  if (typeof packageFile === 'string') {
    packageFile = { packageFile };
  }
  const packageFileConfig = configParser.mergeChildConfig(
    repoConfig,
    packageFile
  );
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
