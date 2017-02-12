const logger = require('winston');
const path = require('path');
const packageJson = require('../helpers/package-json');
const yarnHelper = require('../helpers/yarn');

module.exports = {
  ensureBranch,
};

async function ensureBranch(api, config, branchName, depType, depName, newVersion, commitMessage) {
  const branchExists = await api.branchExists(branchName);
  if (branchExists) {
    await updateExistingBranch(api, config, branchName, depType, depName,
      newVersion, commitMessage);
    return;
  }
  await createNewBranch(api, config, branchName, depType, depName, newVersion, commitMessage);
}

async function updateExistingBranch(api, config, branchName, depType, depName,
  newVersion, commitMessage) {
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
  const newContent = packageJson.setNewValue(
    existingContent,
    depType,
    depName,
    newVersion);
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
    const npmrcContent = await api.getFileContent('.npmrc');
    const yarnrcContent = await api.getFileContent('.yarnrc');
    const newYarnLockContent =
      await yarnHelper.generateLockFile(newContent, npmrcContent, yarnrcContent);
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

async function createNewBranch(api, config, branchName, depType, depName,
  newVersion, commitMessage) {
  logger.verbose(`${depName}: creating new branch ${branchName}`);
  const existingContent = await api.getFileContent(config.packageFile);
  const newContent = packageJson.setNewValue(
    existingContent,
    depType,
    depName,
    newVersion);
  const files = [{
    name: config.packageFile,
    contents: newContent,
  }];
  const yarnLockFileName = path.join(path.dirname(config.packageFile), 'yarn.lock');
  if (await api.getFileContent(yarnLockFileName)) {
    const npmrcContent = await api.getFileContent('.npmrc');
    const yarnrcContent = await api.getFileContent('.yarnrc');
    const newYarnLockContent =
      await yarnHelper.generateLockFile(newContent, npmrcContent, yarnrcContent);
    files.push({
      name: yarnLockFileName,
      contents: newYarnLockContent,
    });
  }
  await api.commitFilesToBranch(branchName, files, commitMessage);
}
