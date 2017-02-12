const logger = require('winston');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('./api/github');
const gitlabApi = require('./api/gitlab');
const handlebars = require('./helpers/handlebars');
const versionsHelper = require('./helpers/versions');
const packageJson = require('./helpers/package-json');
const npmApi = require('./api/npm');
const prWorker = require('./workers/pr');
const branchWorker = require('./workers/branch');
const getChangeLog = require('./helpers/changelog');

let config;
let api;

module.exports = renovate;

// This function manages the queue per-package file
async function renovate(repoName, packageFile, packageConfig) {
  if (packageConfig.platform === 'github') {
    api = githubApi;
  }
  if (packageConfig.platform === 'gitlab') {
    api = gitlabApi;
  }
  // Initialize globals
  config = Object.assign({}, packageConfig);
  config.packageFile = packageFile;

  logger.info(`Processing ${repoName} ${packageFile}`);

  const packageContent = await api.getFileJson(packageFile);
  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.debug(`package.json>renovate config: ${stringify(packageContent.renovate)}`);
    Object.assign(config, packageContent.renovate, { repoConfigured: true });
  }
  // Now check if config is disabled
  if (config.enabled === false) {
    logger.info('Config is disabled. Skipping');
    return;
  }

  // Extract all dependencies from the package.json
  let dependencies = await packageJson.extractDependencies(packageContent, config.depTypes);
  // Filter out ignored dependencies
  dependencies =
    dependencies.filter(dependency => config.ignoreDeps.indexOf(dependency.depName) === -1);
  // Find all upgrades for remaining dependencies
  const upgrades = await findUpgrades(dependencies);
  // Process all upgrades sequentially
  await processUpgradesSequentially(upgrades);
  logger.info(`${repoName} ${packageFile} done`);
}

async function findUpgrades(dependencies) {
  const allUpgrades = [];
  // findDepUpgrades can add more than one upgrade to allUpgrades
  async function findDepUpgrades(dep) {
    const npmDependency = await npmApi.getDependency(dep.depName);
    const upgrades =
      await versionsHelper.determineUpgrades(npmDependency, dep.currentVersion, config);
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

async function processUpgradesSequentially(upgrades) {
  if (Object.keys(upgrades).length) {
    logger.verbose('Processing upgrades');
  } else {
    logger.verbose('No upgrades to process');
  }
  logger.verbose(`All upgrades: ${JSON.stringify(upgrades)}`);
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  for (const upgrade of upgrades) {
    await updateDependency(upgrade);
  }
}

async function updateDependency(upgrade) {
  // Expand upgrade params
  const depType = upgrade.depType;
  const depName = upgrade.depName;
  const newVersion = upgrade.newVersion;
  // Helpers for templating
  const params = Object.assign({}, upgrade);
  if (upgrade.upgradeType === 'pin') {
    params.isPin = true;
  } else if (upgrade.upgradeType === 'major') {
    params.isMajor = true;
  } else if (upgrade.upgradeType === 'minor') {
    params.isMinor = true;
  }
  // Use templates to generate strings
  const branchName = handlebars.transform(config.branchName, params);
  const commitMessage = handlebars.transform(config.commitMessage, params);
  const prTitle = handlebars.transform(config.prTitle, params);

  try {
    const closedPrExists = await checkForClosedPr();
    if (closedPrExists) {
      logger.verbose(`Skipping ${depName} upgrade as matching closed PR already existed`);
      return;
    }
    await branchWorker.ensureBranch(api, config, branchName, depType, depName,
      newVersion, commitMessage);
    const log = await getChangeLog(upgrade);
    const configWithChangeLog = Object.assign({}, config, log);
    await prWorker.ensurePr(api, configWithChangeLog);
  } catch (error) {
    logger.error(`Error updating dependency ${depName}: ${error}`);
    // Don't throw here - we don't want to stop the other renovations
  }

  // Check if same PR already existed and skip if so
  // This allows users to close an unwanted upgrade PR and not worry about seeing it raised again
  async function checkForClosedPr() {
    if (config.recreateClosed) {
      logger.debug(`${depName}: Skipping closed PR check`);
      return false;
    }
    logger.debug(`${depName}: Checking for closed PR`);
    const prExisted = await api.checkForClosedPr(branchName, prTitle);
    logger.debug(`Closed PR existed: ${prExisted}`);
    if (prExisted) {
      return true;
    }
    return false;
  }
}
