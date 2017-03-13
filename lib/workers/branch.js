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

async function getYarnLockFile(packageJson, config) {
  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
  if (!await config.api.getFileContent(yarnLockFileName)) {
    return null;
  }
  // Copy over custom config files
  const npmrcContent = await config.api.getFileContent('.npmrc');
  const yarnrcContent = await config.api.getFileContent('.yarnrc');
  // Generate yarn.lock using shell command
  const newYarnLockContent =
    await yarnHelper.generateLockFile(packageJson, npmrcContent, yarnrcContent);
  // Return file object
  return ({
    name: yarnLockFileName,
    contents: newYarnLockContent,
  });
}

// Ensure branch exists with appropriate content
async function ensureBranch(config) {
  const branchName = handlebars.compile(config.branchName)(config);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  const parentBranch = await module.exports.getParentBranch(branchName, config);
  // If we are rebasing then existing content will be from master
  const existingContent = await config.api.getFileContent(config.packageFile, parentBranch);
  const newContent = packageJsonHelper.setNewValue(
    existingContent,
    config.depType,
    config.depName,
    config.newVersion);
  // This should only happen if updating a branch
  if (newContent === existingContent) {
    logger.debug(`Branch ${parentBranch} is already up-to-date`);
    return;
  }
  // We always have a package.json
  const files = [{
    name: config.packageFile,
    contents: newContent,
  }];
  const yarnLockFile = await module.exports.getYarnLockFile(newContent, config);
  if (yarnLockFile) {
    // Add new yarn.lock file too
    files.push(yarnLockFile);
  }
  const commitMessage = handlebars.compile(config.commitMessage)(config);
  // API will know whether to create new branch or not
  await config.api.commitFilesToBranch(branchName, files, commitMessage, parentBranch);
}
