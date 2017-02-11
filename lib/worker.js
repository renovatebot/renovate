const logger = require('winston');
const changelog = require('changelog');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('./api/github');
const gitlabApi = require('./api/gitlab');
const handlebars = require('./helpers/handlebars');
const versionsHelper = require('./helpers/versions');
const packageJson = require('./helpers/package-json');
const npmApi = require('./api/npm');

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
    await ensureBranch();
    const log = await getChangelog(upgrade);
    await ensurePr(log, branchName, prTitle);
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

  async function ensureBranch() {
    const branchExists = await api.branchExists(branchName);
    if (branchExists) {
      await updateExistingBranch();
      return;
    }
    await createNewBranch();
  }

  function getNewPackageJson(content) {
    return packageJson.setNewValue(
      content,
      depType,
      depName,
      newVersion);
  }

  async function updateExistingBranch() {
    // By default, we'll add a commit to the existing branch if necessary
    let parentBranch = branchName;
    logger.debug(`Checking if branch ${branchName} needs updating`);
    const pr = await api.getBranchPr(branchName);
    if (pr && (pr.isUnmergeable || (pr.isStale && config.rebaseStalePRs))) {
      if (pr.isUnmergeable) {
        logger.verbose(`Existing ${pr.displayNumber} is not mergeable`);
      } else if (pr.isStale) {
        logger.verbose(`Existing ${pr.displayNumber} is stalled`);
      }
      if (pr.canRebase) {
        // Only supported by GitHub
        // Setting parentBranch to undefined means that we'll use the default branch
        parentBranch = undefined;
        logger.debug(`Rebasing branch ${branchName}`);
      } else {
        logger.debug(`Cannot rebase branch ${branchName}`);
      }
    }
    const existingContent = await api.getFileContent(config.packageFile, parentBranch);
    const newContent = getNewPackageJson(existingContent);
    if (newContent === existingContent) {
      logger.debug(`Branch ${parentBranch} is already up-to-date`);
      return;
    }
    logger.verbose(`Adding commit '${commitMessage}' to branch ${branchName}`);
    const files = [{
      name: config.packageFile,
      contents: newContent,
    }];
    const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
    if (await api.getFileContent(yarnLockFileName)) {
      const newYarnLockContent = await generateLockFile(newContent);
      files.push({
        name: yarnLockFileName,
        contents: newYarnLockContent,
      });
    }
    await api.commitFilesToBranch(
      branchName,
      files,
      commitMessage,
      parentBranch);
  }

  async function createNewBranch() {
    logger.verbose(`${depName}: creating new branch ${branchName}`);
    const existingContent = await api.getFileContent(config.packageFile);
    const newContent = await getNewPackageJson(existingContent);
    const files = [{
      name: config.packageFile,
      contents: newContent,
    }];
    const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
    if (await api.getFileContent(yarnLockFileName)) {
      const newYarnLockContent = await generateLockFile(newContent);
      files.push({
        name: yarnLockFileName,
        contents: newYarnLockContent,
      });
    }
    await api.commitFilesToBranch(branchName, files, commitMessage);
  }
}

async function generateLockFile(newPackageJson) {
  logger.debug('Generating new yarn.lock file');
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  let yarnLock;
  try {
    fs.writeFileSync(path.join(tmpDir.name, 'package.json'), newPackageJson);
    const npmrcContent = await api.getFileContent('.npmrc');
    if (npmrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.npmrc'), npmrcContent);
    }
    const yarnrcContent = await api.getFileContent('.yarnrc');
    if (yarnrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.yarnrc'), yarnrcContent);
    }
    cp.spawnSync('yarn', ['install'], { cwd: tmpDir.name });
    yarnLock = fs.readFileSync(path.join(tmpDir.name, 'yarn.lock'));
  } catch (error) {
    tmpDir.removeCallback();
    throw error;
  }
  tmpDir.removeCallback();
  return yarnLock;
}

// Get Changelog
async function getChangelog(upgrade) {
  if (!upgrade.workingVersion || upgrade.workingVersion === upgrade.newVersion) {
    return Object.assign(upgrade, { changelog: '' });
  }
  const semverString = `>${upgrade.workingVersion} <=${upgrade.newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  let markdownLog;
  try {
    const log = await changelog.generate(upgrade.depName, semverString);
    markdownLog = changelog.markdown(log);
  } catch (error) {
    logger.verbose(`getChangelog error: ${error}`);
  }
  // Add a header if log exists
  if (!markdownLog) {
    logger.verbose(`No changelog for ${upgrade.depName}`);
    markdownLog = '';
  } else {
    markdownLog = `### Changelog\n\n${markdownLog}`;
    markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  }
  return Object.assign(upgrade, { changelog: markdownLog });
}

// Create a new PR
async function createPr(branchName, prTitle, prBody, labels, assignees, reviewers) {
  logger.debug(`Creating PR for branch ${branchName}`);
  const pr = await api.createPr(branchName, prTitle, prBody);
  if (labels.length > 0) {
    await api.addLabels(pr.number, labels);
  }
  if (assignees.length > 0) {
    await api.addAssignees(pr.number, assignees);
  }
  if (reviewers.length > 0) {
    await api.addReviewers(pr.number, reviewers);
  }
  return pr;
}


// Ensures that PR exists with matching title/body
async function ensurePr(upgradeWithChangeLog, branchName, prTitle) {
  logger.debug('Ensuring PR');

  const prBody = handlebars.transform(config.prBody, upgradeWithChangeLog);

  try {
    const existingPr = await api.getBranchPr(branchName);
    if (existingPr) {
      await checkExistingPr(existingPr, prTitle, prBody);
    } else {
      const newPr = await createPr(branchName,
        prTitle,
        prBody,
        config.labels,
        config.assignees,
        config.reviewers);
      logger.info(`Created ${newPr.displayNumber}`);
    }
  } catch (error) {
    logger.error('Failed to ensure PR:', error);
  }
}

// Check an existing PR and update it if necessary
async function checkExistingPr(pr, prTitle, prBody) {
  // Check if existing PR needs updating
  if (pr.title === prTitle && pr.body === prBody) {
    logger.verbose(`${pr.displayNumber} already up-to-date`);
    return;
  }
  // PR must need updating
  logger.debug(`updatePr: ${pr.number}`);
  await api.updatePr(pr.number, prTitle, prBody);
  logger.info(`Updated ${pr.displayNumber}`);
}
