const logger = require('winston');
const path = require('path');
const handlebars = require('handlebars');
const packageJsonHelper = require('../helpers/package-json');
const yarnHelper = require('../helpers/yarn');

module.exports = {
  getParentBranch,
  getYarnLockFile,
  ensureBranch,
};

async function getParentBranch(branchName, config) {
  // Check if branch exists
  if (await config.api.branchExists(branchName) === false) {
    logger.verbose(`Creating new branch ${branchName}`);
    return undefined;
  }
  logger.debug(`${branchName} already exists`);
  // Check for existing PR
  const pr = await config.api.getBranchPr(branchName);
  // Decide if we need to rebase
  if (!pr) {
    logger.debug(`No PR found for ${branchName}`);
    // We can't tell if this branch can be rebased so better not
    return branchName;
  }
  if (pr.isUnmergeable) {
    logger.debug('PR is unmergeable');
    if (pr.canRebase) {
      // Only supported by GitHub
      // Setting parentBranch back to undefined means that we'll use the default branch
      logger.debug(`Rebasing branch ${branchName}`);
      return undefined;
    }
    // Don't do anything different, but warn
    logger.verbose(`Cannot rebase branch ${branchName}`);
  }
  if (pr.isStale && config.rebaseStalePrs) {
    logger.verbose(`Existing PR for ${branchName} is stale`);
    if (pr.canRebase) {
      // Only supported by GitHub
      // Setting parentBranch back to undefined means that we'll use the default branch
      logger.debug(`Rebasing branch ${branchName}`);
      return undefined;
    }
    // Don't do anything different, but warn
    logger.verbose(`Cannot rebase branch ${branchName}`);
  }
  logger.debug(`Existing ${branchName} does not need rebasing`);
  return branchName;
}

async function getYarnLockFile(packageFile, packageContent, api) {
  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(path.dirname(packageFile), 'yarn.lock');
  if (!await api.getFileContent(yarnLockFileName)) {
    return null;
  }
  // Copy over custom config commitFiles
  const npmrcContent = await api.getFileContent('.npmrc');
  const yarnrcContent = await api.getFileContent('.yarnrc');
  // Generate yarn.lock using shell command
  const newYarnLockContent =
    await yarnHelper.generateLockFile(packageContent, npmrcContent, yarnrcContent);
  // Return file object
  return ({
    name: yarnLockFileName,
    contents: newYarnLockContent,
  });
}

// Ensure branch exists with appropriate content
async function ensureBranch(upgrades) {
  logger.verbose(`ensureBranch(${JSON.stringify(upgrades)})`);
  // Use the first upgrade for all the templates
  const branchName = handlebars.compile(upgrades[0].branchName)(upgrades[0]);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  const parentBranch = await module.exports.getParentBranch(branchName, upgrades[0]);
  const commitMessage = handlebars.compile(upgrades[0].commitMessage)(upgrades[0]);
  const api = upgrades[0].api;
  const packageFiles = {};
  for (const upgrade of upgrades) {
    // See if this is the first time editing this file
    if (!packageFiles[upgrade.packageFile]) {
      // If we are rebasing then existing content will be from master
      packageFiles[upgrade.packageFile] =
        await api.getFileContent(upgrade.packageFile, parentBranch);
    }
    const newContent = packageJsonHelper.setNewValue(
      packageFiles[upgrade.packageFile],
      upgrade.depType,
      upgrade.depName,
      upgrade.newVersion);
    if (packageFiles[upgrade.packageFile] === newContent) {
      logger.debug('packageFile content unchanged');
      delete packageFiles[upgrade.packageFile];
    } else {
      logger.debug('Updating packageFile content');
      packageFiles[upgrade.packageFile] = newContent;
    }
  }
  if (Object.keys(packageFiles).length > 0) {
    const commitFiles = [];
    for (const packageFile of Object.keys(packageFiles)) {
      commitFiles.push({
        name: packageFile,
        contents: packageFiles[packageFile],
      });
      const yarnLockFile =
        await module.exports.getYarnLockFile(packageFile, packageFiles[packageFile], api);
      if (yarnLockFile) {
        // Add new yarn.lock file too
        commitFiles.push(yarnLockFile);
      }
    }

    // API will know whether to create new branch or not
    await api.commitFilesToBranch(branchName, commitFiles, commitMessage, parentBranch);
  }
}
