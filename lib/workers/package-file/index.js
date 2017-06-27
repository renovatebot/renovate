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
  logger.debug(`dependencies=${JSON.stringify(dependencies)}`);
  // Filter out ignored dependencies
  dependencies = dependencies.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  dependencies = module.exports.assignDepConfigs(config, dependencies);
  logger.debug(`dependencies=${JSON.stringify(dependencies)}`);
  // Find all upgrades for remaining dependencies
  const upgrades = await module.exports.findUpgrades(dependencies);
  logger.debug(`upgrades=${JSON.stringify(upgrades)}`);
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
    const depTypeConfig = getDepTypeConfig(inputConfig.depTypes, dep.depType);
    const returnDep = Object.assign({}, inputConfig, depTypeConfig, dep);
    let packageRuleApplied = false;
    if (returnDep.packages) {
      // Loop through list looking for match
      // Exit after first match
      returnDep.packages.forEach(packageConfig => {
        if (!packageRuleApplied) {
          const pattern =
            packageConfig.packagePattern || `^${packageConfig.packageName}$`;
          const packageRegex = new RegExp(pattern);
          if (dep.depName.match(packageRegex)) {
            packageRuleApplied = true;
            Object.assign(returnDep, packageConfig);
            delete returnDep.packageName;
            delete returnDep.packagePattern;
          }
        }
      });
    }
    // TODO: clean this up
    delete returnDep.depTypes;
    delete returnDep.enabled;
    delete returnDep.onboarding;
    delete returnDep.endpoint;
    delete returnDep.autodiscover;
    delete returnDep.token;
    delete returnDep.githubAppId;
    delete returnDep.githubAppKey;
    delete returnDep.packageFiles;
    delete returnDep.logLevel;
    delete returnDep.renovateJsonPresent;
    delete returnDep.ignoreDeps;
    delete returnDep.packages;
    delete returnDep.maintainYarnLock;
    delete returnDep.yarnMaintenanceBranchName;
    delete returnDep.yarnMaintenanceCommitMessage;
    delete returnDep.yarnMaintenancePrTitle;
    delete returnDep.yarnMaintenancePrBody;
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
