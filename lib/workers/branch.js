const logger = require('winston');
const path = require('path');
const handlebars = require('handlebars');
const packageJson = require('../helpers/package-json');
const yarnHelper = require('../helpers/yarn');

module.exports = {
  ensureBranch,
};

async function ensureBranch(config) {
  const branchName = handlebars.compile(config.branchName)(config);
  const commitMessage = handlebars.compile(config.commitMessage)(config);
  const branchExists = await config.api.branchExists(branchName);
  if (branchExists) {
    await updateExistingBranch(config, branchName, commitMessage);
    return;
  }
  await createNewBranch(config, branchName, commitMessage);
}

async function updateExistingBranch(config, branchName, commitMessage) {
  // By default, we'll add a commit to the existing branch if necessary
  let parentBranch = branchName;
  logger.debug(`Checking if branch ${branchName} needs updating`);
  const pr = await config.api.getBranchPr(branchName);
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
  const existingContent = await config.api.getFileContent(config.packageFile, parentBranch);
  const newContent = packageJson.setNewValue(
    existingContent,
    config.depType,
    config.depName,
    config.newVersion);
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
  if (await config.api.getFileContent(yarnLockFileName)) {
    const npmrcContent = await config.api.getFileContent('.npmrc');
    const yarnrcContent = await config.api.getFileContent('.yarnrc');
    const newYarnLockContent =
      await yarnHelper.generateLockFile(newContent, npmrcContent, yarnrcContent);
    files.push({
      name: yarnLockFileName,
      contents: newYarnLockContent,
    });
  }
  await config.api.commitFilesToBranch(
    branchName,
    files,
    commitMessage,
    parentBranch);
}

async function createNewBranch(config, branchName, commitMessage) {
  logger.verbose(`${config.depName}: creating new branch ${branchName}`);
  const existingContent = await config.api.getFileContent(config.packageFile);
  const newContent = packageJson.setNewValue(
    existingContent,
    config.depType,
    config.depName,
    config.newVersion);
  const files = [{
    name: config.packageFile,
    contents: newContent,
  }];
  const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
  if (await config.api.getFileContent(yarnLockFileName)) {
    const npmrcContent = await config.api.getFileContent('.npmrc');
    const yarnrcContent = await config.api.getFileContent('.yarnrc');
    const newYarnLockContent =
      await yarnHelper.generateLockFile(newContent, npmrcContent, yarnrcContent);
    files.push({
      name: yarnLockFileName,
      contents: newYarnLockContent,
    });
  }
  await config.api.commitFilesToBranch(branchName, files, commitMessage);
}
