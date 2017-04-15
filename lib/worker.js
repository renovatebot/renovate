const logger = require('winston');
const path = require('path');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('./api/github');
const gitlabApi = require('./api/gitlab');
const handlebars = require('handlebars');
const versionsHelper = require('./helpers/versions');
const packageJson = require('./helpers/package-json');
const npmApi = require('./api/npm');
const prWorker = require('./workers/pr');
const branchWorker = require('./workers/branch');

let config;

module.exports = {
  processPackageFile,
  findUpgrades,
  processUpgrades,
  updateBranch,
  assignDepConfigs,
  getDepTypeConfig,
  maintainYarnLock,
};

// This function manages the queue per-package file
async function processPackageFile(repoName, packageFile, packageConfig) {
  // Initialize globals
  config = Object.assign({}, packageConfig);
  config.packageFile = packageFile;

  // Set API
  if (packageConfig.platform === 'github') {
    config.api = githubApi;
  }
  if (packageConfig.platform === 'gitlab') {
    config.api = gitlabApi;
  }

  logger.info(`Processing ${repoName} ${packageFile}`);

  const packageContent = await config.api.getFileJson(packageFile);
  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.debug(`package.json>renovate config: ${stringify(packageContent.renovate)}`);
    Object.assign(config, packageContent.renovate, { repoConfigured: true });
  }
  // Now check if config is disabled
  if (config.enabled === false) {
    logger.info('Config is disabled. Skipping');
    return [];
  }

  const depTypes = config.depTypes.map((depType) => {
    if (typeof depType === 'string') {
      return depType;
    }
    return depType.depType;
  });

  // Extract all dependencies from the package.json
  let dependencies = await packageJson.extractDependencies(packageContent, depTypes);
  // Filter out ignored dependencies
  dependencies =
    dependencies.filter(dependency => config.ignoreDeps.indexOf(dependency.depName) === -1);
  dependencies = assignDepConfigs(config, dependencies);
  // Find all upgrades for remaining dependencies
  const upgrades = await findUpgrades(dependencies);
  // Process all upgrades sequentially
  if (config.maintainYarnLock) {
    await maintainYarnLock(config);
  }
  return upgrades;
}

// Add custom config for each dep
function assignDepConfigs(inputConfig, deps) {
  return deps.map((dep) => {
    const returnDep = Object.assign({}, dep);
    returnDep.config =
      Object.assign({}, inputConfig, getDepTypeConfig(inputConfig.depTypes, dep.depType));
    let packageRuleApplied = false;
    if (returnDep.config.packages) {
      // Loop through list looking for match
      // Exit after first match
      returnDep.config.packages.forEach((packageConfig) => {
        if (!packageRuleApplied) {
          const pattern = packageConfig.packagePattern || `^${packageConfig.packageName}$`;
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
    delete returnDep.config.depType;
    delete returnDep.config.depTypes;
    delete returnDep.config.enabled;
    delete returnDep.config.onboarding;
    delete returnDep.config.token;
    delete returnDep.config.packageFiles;
    delete returnDep.config.logLevel;
    delete returnDep.config.repoConfigured;
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

function getDepTypeConfig(depTypes, depTypeName) {
  let depTypeConfig = {};
  if (depTypes) {
    depTypes.forEach((depType) => {
      if (typeof depType !== 'string' && depType.depType === depTypeName) {
        depTypeConfig = depType;
      }
    });
  }
  return depTypeConfig;
}

async function maintainYarnLock(inputConfig) {
  const packageContent = await inputConfig.api.getFileContent(inputConfig.packageFile);
  const yarnLockFileName = path.join(path.dirname(inputConfig.packageFile), 'yarn.lock');
  logger.debug(`Checking for ${yarnLockFileName}`);
  const existingYarnLock = await inputConfig.api.getFileContent(yarnLockFileName);
  if (!existingYarnLock) {
    return;
  }
  logger.debug('Found existing yarn.lock file');
  const newYarnLock = await branchWorker.getYarnLockFile(packageContent, inputConfig);
  if (existingYarnLock === newYarnLock.contents) {
    logger.debug('Yarn lock file does not need updating');
    return;
  }
  logger.debug('Yarn lock needs updating');
  // API will know whether to create new branch or not
  const params = Object.assign({}, inputConfig);
  const commitMessage = handlebars.compile(params.yarnMaintenanceCommitMessage)(params);
  params.branchName = params.yarnMaintenanceBranchName;
  params.prTitle = params.yarnMaintenancePrTitle;
  params.prBody = params.yarnMaintenancePrBody;
  await inputConfig.api.commitFilesToBranch(params.branchName, [newYarnLock], commitMessage);
  prWorker.ensurePr(params);
}

async function findUpgrades(dependencies) {
  const allUpgrades = [];
  // findDepUpgrades can add more than one upgrade to allUpgrades
  async function findDepUpgrades(dep) {
    const npmDependency = await npmApi.getDependency(dep.depName);
    const upgrades =
      await versionsHelper.determineUpgrades(npmDependency, dep.currentVersion, dep.config);
    if (upgrades.length > 0) {
      logger.verbose(`${dep.depName}: Upgrades = ${JSON.stringify(upgrades)}`);
      upgrades.forEach((upgrade) => {
        allUpgrades.push(Object.assign({}, dep, upgrade));
      });
    } else {
      logger.verbose(`${dep.depName}: No upgrades required`);
    }
  }
  const promiseArray = dependencies.map(dep => findDepUpgrades(dep));
  // Use Promise.all to execute npm queries in parallel
  await Promise.all(promiseArray);
  // Return the upgrade array once all Promises are complete
  return allUpgrades;
}

async function processUpgrades(upgrades) {
  if (upgrades.length) {
    logger.verbose('Processing upgrades');
  } else {
    logger.verbose('No upgrades to process');
  }
  logger.verbose(`All upgrades: ${JSON.stringify(upgrades)}`);
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
    const branchName = handlebars.compile(flattened.branchName)(flattened);
    if (!branchUpgrades[branchName]) {
      branchUpgrades[branchName] = [];
    }
    branchUpgrades[branchName].push(flattened);
  }
  logger.verbose(`Branched upgrades: ${JSON.stringify(branchUpgrades)}`);
  for (const branch of Object.keys(branchUpgrades)) {
    await module.exports.updateBranch(branchUpgrades[branch]);
  }
}

async function updateBranch(upgrades) {
  // Use templates to generate strings
  const upgrade0 = upgrades[0];
  const branchName = handlebars.compile(upgrade0.branchName)(upgrade0);
  const prTitle = handlebars.compile(upgrade0.prTitle)(upgrade0);

  logger.verbose(`branchName '${branchName}' length is ${upgrades.length}`);

  try {
    if (!upgrade0.recreateClosed && await upgrade0.api.checkForClosedPr(branchName, prTitle)) {
      logger.verbose(`Skipping ${branchName} upgrade as matching closed PR already existed`);
      return;
    }
    await branchWorker.ensureBranch(upgrades);
    await prWorker.ensurePr(upgrade0);
  } catch (error) {
    logger.error(`Error updating branch ${branchName}: ${error}`);
    // Don't throw here - we don't want to stop the other renovations
  }
}
