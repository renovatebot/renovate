const convertHrTime = require('convert-hrtime');
const handlebars = require('handlebars');
const configParser = require('../../config');
const packageFileWorker = require('../package-file');

let logger = require('../../logger');

module.exports = {
  determineRepoUpgrades,
  groupByBranch,
  generateConfig,
  branchifyUpgrades,
  getPackageFileConfig,
};

async function determineRepoUpgrades(config) {
  logger.trace({ config }, 'determineRepoUpgrades');
  const startTime = process.hrtime();
  if (config.packageFiles.length === 0) {
    logger.warn('No package files found');
  }
  let upgrades = [];
  // Iterate through repositories sequentially
  for (let index = 0; index < config.packageFiles.length; index += 1) {
    const packageFileConfig = module.exports.getPackageFileConfig(
      config,
      index
    );
    if (packageFileConfig.packageFile.endsWith('package.json')) {
      logger.info(
        { packageFile: packageFileConfig.packageFile },
        'Renovating package.json dependencies'
      );
      upgrades = upgrades.concat(
        await packageFileWorker.renovatePackageFile(packageFileConfig)
      );
    } else if (packageFileConfig.packageFile.endsWith('package.js')) {
      logger.info('Renovating package.js (meteor) dependencies');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateMeteorPackageFile(packageFileConfig)
      );
    } else if (packageFileConfig.packageFile.endsWith('Dockerfile')) {
      logger.info('Renovating Dockerfile FROM');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateDockerfile(packageFileConfig)
      );
    }
  }
  logger.info(
    { seconds: convertHrTime(process.hrtime(startTime)).seconds },
    'Finished determining repo upgrades'
  );
  return upgrades;
}

function generateConfig(branchUpgrades) {
  const config = {
    upgrades: [],
  };
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.debug(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const groupEligible =
    branchUpgrades.length > 1 || branchUpgrades[0].lazyGrouping === false;
  logger.debug(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.debug(`useGroupSettings: ${useGroupSettings}`);
  for (const branchUpgrade of branchUpgrades) {
    const upgrade = { ...branchUpgrade };
    if (useGroupSettings) {
      // Now overwrite original config with group config
      Object.assign(upgrade, upgrade.group);
    } else {
      delete upgrade.groupName;
    }
    // Delete group config regardless of whether it was applied
    delete upgrade.group;
    delete upgrade.lazyGrouping;
    // Use templates to generate strings
    logger.debug('Compiling branchName and prTitle');
    upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
    upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
    if (upgrade.semanticCommits) {
      logger.debug('Upgrade has semantic commits enabled');
      upgrade.prTitle = `${upgrade.semanticPrefix} ${upgrade.prTitle.toLowerCase()}`;
    }
    logger.debug(`${upgrade.branchName}, ${upgrade.prTitle}`);
    config.upgrades.push(upgrade);
  }
  // Now assign first upgrade's config as branch config
  return { ...config, ...config.upgrades[0] };
}

function groupByBranch(upgrades) {
  logger.trace({ config: upgrades }, 'groupByBranch');
  logger.info(`Processing ${upgrades.length} dependency upgrade(s)`);
  const result = {
    errors: [],
    warnings: [],
    branchUpgrades: {},
  };
  for (const upg of upgrades) {
    const upgrade = { ...upg };
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
          `Dependency ${upgrade.depName} is part of group ${upgrade.groupName}`
        );
        upgrade.groupSlug =
          upgrade.groupSlug ||
          upgrade.groupName
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9+]+/g, '-');
        branchName = handlebars.compile(upgrade.group.branchName)(upgrade);
      } else {
        // Use regular branchName template
        if (upgrade.depName) {
          upgrade.depNameSanitized = upgrade.depName
            .replace('@', '')
            .replace('/', '-')
            .toLowerCase();
        }
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

async function branchifyUpgrades(upgrades, parentLogger) {
  logger = parentLogger || logger;
  logger.debug('branchifyUpgrades');
  logger.trace({ config: upgrades }, 'branchifyUpgrades');
  const branchConfigs = [];
  const res = module.exports.groupByBranch(upgrades);
  for (const branchName of Object.keys(res.branchUpgrades)) {
    logger = logger.child({ branch: branchName });
    const branchUpgrades = res.branchUpgrades[branchName];
    const branchConfig = module.exports.generateConfig(branchUpgrades);
    branchConfig.branchName = branchName;
    branchConfig.logger = logger;
    branchConfigs.push(branchConfig);
  }
  return {
    errors: res.errors,
    warnings: res.warnings,
    upgrades: branchConfigs,
  };
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
