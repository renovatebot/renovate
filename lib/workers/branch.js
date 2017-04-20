const logger = require('winston');
const handlebars = require('handlebars');
const packageJsonHelper = require('../helpers/package-json');
const yarnHelper = require('../helpers/yarn');

module.exports = {
  getParentBranch,
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

// Ensure branch exists with appropriate content
async function ensureBranch(upgrades) {
  logger.debug(`ensureBranch(${JSON.stringify(upgrades)})`);
  // Use the first upgrade for all the templates
  const branchName = handlebars.compile(upgrades[0].branchName)(upgrades[0]);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  const parentBranch = await module.exports.getParentBranch(branchName, upgrades[0]);
  const commitMessage = handlebars.compile(upgrades[0].commitMessage)(upgrades[0]);
  const api = upgrades[0].api;
  const packageFiles = {};
  const commitFiles = [];
  for (const upgrade of upgrades) {
    if (upgrade.upgradeType === 'maintainYarnLock') {
      const newYarnLock = await yarnHelper.maintainLockFile(upgrade);
      if (newYarnLock) {
        commitFiles.push(newYarnLock);
      }
    } else {
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
  }
  if (Object.keys(packageFiles).length > 0) {
    logger.debug(`${Object.keys(packageFiles).length} package file(s) need updating.`);
    for (const packageFile of Object.keys(packageFiles)) {
      logger.debug(`Adding ${packageFile}`);
      commitFiles.push({
        name: packageFile,
        contents: packageFiles[packageFile],
      });
      const yarnLockFile =
        await yarnHelper.getLockFile(packageFile, packageFiles[packageFile], api);
      if (yarnLockFile) {
        // Add new yarn.lock file too
        logger.debug(`Adding ${yarnLockFile.name}`);
        commitFiles.push(yarnLockFile);
      }
    }
  }
  if (commitFiles.length) {
    logger.debug(`Commit ${commitFiles.length} files to branch ${branchName}`);
    // API will know whether to create new branch or not
    await api.commitFilesToBranch(branchName, commitFiles, commitMessage, parentBranch);
    return true;
  }
  logger.debug(`No files to commit to branch ${branchName}`);
  return api.branchExists(branchName);
}
