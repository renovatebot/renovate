const logger = require('winston');
const path = require('path');
const handlebars = require('handlebars');
const packageJson = require('../helpers/package-json');
const yarnHelper = require('../helpers/yarn');

module.exports = {
  decideParentBranch,
  ensureBranch,
};

async function decideParentBranch(branchName, config) {
  logger.debug(`decideParentBranch(${branchName}, config)`);
  // Check for existing PR
  const pr = await config.api.getBranchPr(branchName);
  // Decide if we need to rebase
  if (!pr) {
    logger.debug(`No PR found for ${branchName}`);
    return branchName;
  }
  if (pr.isUnmergeable || (pr.isStale && config.rebaseStalePRs)) {
    if (pr.isUnmergeable) {
      logger.verbose(`Existing ${pr.displayNumber} is not mergeable`);
    } else if (pr.isStale) {
      logger.verbose(`Existing ${pr.displayNumber} is stale`);
    }
    if (pr.canRebase) {
      // Only supported by GitHub
      // Setting parentBranch back to undefined means that we'll use the default branch
      logger.debug(`Rebasing branch ${branchName}`);
      return undefined;
    }
    // Don't do anything different, but warn
    logger.verbose(`Cannot rebase branch ${branchName}`);
  } else {
    logger.debug(`Existing ${branchName} does not need rebasing`);
  }
  return branchName;
}

// Ensure branch exists with appropriate content
async function ensureBranch(config) {
  const branchName = handlebars.compile(config.branchName)(config);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  let parentBranch;
  // Check if branch exists
  if (await config.api.branchExists(branchName)) {
    logger.debug(`${branchName} exists`);
    parentBranch = await decideParentBranch(branchName, config);
    logger.debug(`Using ${parentBranch} as base`);
  } else {
    logger.verbose(`Creating new branch ${branchName}`);
  }
  // If we are rebasing then existing content will be from master
  const existingContent = await config.api.getFileContent(config.packageFile, parentBranch);
  const newContent = packageJson.setNewValue(
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
  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
  if (await config.api.getFileContent(yarnLockFileName)) {
    // Copy over custom configs
    const npmrcContent = await config.api.getFileContent('.npmrc');
    const yarnrcContent = await config.api.getFileContent('.yarnrc');
    const newYarnLockContent =
      await yarnHelper.generateLockFile(newContent, npmrcContent, yarnrcContent);
    // Add new yarn.lock file too
    files.push({
      name: yarnLockFileName,
      contents: newYarnLockContent,
    });
  }
  const commitMessage = handlebars.compile(config.commitMessage)(config);
  // API will know whether to create new branch or not
  await config.api.commitFilesToBranch(branchName, files, commitMessage, parentBranch);
}
