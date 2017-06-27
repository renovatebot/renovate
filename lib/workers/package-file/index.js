const packageJson = require('./package-json');
const packageWorker = require('../package');

let logger = require('../../helpers/logger');

module.exports = {
  findPackageFileUpgrades,
  assignDepConfigs,
  findUpgrades,
  getDepTypeConfig,
};

// This function manages the queue per-package file
async function findPackageFileUpgrades(config) {
  logger = config.logger;
  logger.info(`Processing package file`);
  const packageContent = await config.api.getFileJson(config.packageFile);

  if (!packageContent) {
    logger.warn('No package.json content found - skipping');
    return [];
  }

  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.debug(
      { config: packageContent.renovate },
      'package.json>renovate config'
    );
    // package.json>renovate config takes precedence over existing config
    Object.assign(config, packageContent.renovate);
  }
  // Now check if config is disabled
  if (config.enabled === false) {
    logger.info('Config is disabled. Skipping');
    return [];
  }

  const depTypes = config.depTypes.map(depType => {
    if (typeof depType === 'string') {
      return depType;
    }
    return depType.depType;
  });

  // Extract all dependencies from the package.json
  let dependencies = await packageJson.extractDependencies(
    packageContent,
    depTypes
  );
  // Filter out ignored dependencies
  dependencies = dependencies.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  dependencies = module.exports.assignDepConfigs(config, dependencies);
  // Find all upgrades for remaining dependencies
  const upgrades = await module.exports.findUpgrades(dependencies);
  // Process all upgrades sequentially
  if (config.maintainYarnLock) {
    const upgrade = Object.assign({}, config, {
      upgradeType: 'maintainYarnLock',
    });
    upgrade.upgradeType = 'maintainYarnLock';
    upgrade.commitMessage = upgrade.yarnMaintenanceCommitMessage;
    upgrade.branchName = upgrade.yarnMaintenanceBranchName;
    upgrade.prTitle = upgrade.yarnMaintenancePrTitle;
    upgrade.prBody = upgrade.yarnMaintenancePrBody;
    upgrades.push(upgrade);
  }
  logger.info('Finished processing package file');
  return upgrades;
}

// Add custom config for each dep
function assignDepConfigs(inputConfig, deps) {
  return deps.map(dep => {
    const returnDep = Object.assign({}, dep);
    returnDep.config = Object.assign(
      {},
      inputConfig,
      getDepTypeConfig(inputConfig.depTypes, dep.depType)
    );
    let packageRuleApplied = false;
    if (returnDep.config.packages) {
      // Loop through list looking for match
      // Exit after first match
      returnDep.config.packages.forEach(packageConfig => {
        if (!packageRuleApplied) {
          const pattern =
            packageConfig.packagePattern || `^${packageConfig.packageName}$`;
          const packageRegex = new RegExp(pattern);
          if (dep.depName.match(packageRegex)) {
            packageRuleApplied = true;
            Object.assign(returnDep.config, packageConfig);
            delete returnDep.config.packageName;
            delete returnDep.config.packagePattern;
          }
        }
      });
    }
    // TODO: clean this up
    delete returnDep.config.depType;
    delete returnDep.config.depTypes;
    delete returnDep.config.enabled;
    delete returnDep.config.onboarding;
    delete returnDep.config.endpoint;
    delete returnDep.config.autodiscover;
    delete returnDep.config.token;
    delete returnDep.config.githubAppId;
    delete returnDep.config.githubAppKey;
    delete returnDep.config.packageFiles;
    delete returnDep.config.logLevel;
    delete returnDep.config.renovateJsonPresent;
    delete returnDep.config.ignoreDeps;
    delete returnDep.config.packages;
    delete returnDep.config.maintainYarnLock;
    delete returnDep.config.yarnMaintenanceBranchName;
    delete returnDep.config.yarnMaintenanceCommitMessage;
    delete returnDep.config.yarnMaintenancePrTitle;
    delete returnDep.config.yarnMaintenancePrBody;
    return returnDep;
  });
}

async function findUpgrades(dependencies) {
  // findDepUpgrades can add more than one upgrade to allUpgrades
  const promiseArray = dependencies.map(dep =>
    packageWorker.findDepUpgrades(dep)
  );
  // Use Promise.all to execute npm queries in parallel
  const allUpgrades = await Promise.all(promiseArray);
  // Squash arrays into one
  return [].concat(...allUpgrades);
}

function getDepTypeConfig(depTypes, depTypeName) {
  let depTypeConfig = {};
  if (depTypes) {
    depTypes.forEach(depType => {
      if (typeof depType !== 'string' && depType.depType === depTypeName) {
        depTypeConfig = depType;
      }
    });
  }
  return depTypeConfig;
}
