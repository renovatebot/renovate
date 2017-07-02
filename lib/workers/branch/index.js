const handlebars = require('handlebars');
const packageJsonHelper = require('./package-json');
const npm = require('./npm');
const yarn = require('./yarn');
const prWorker = require('../pr');
let logger = require('../../logger');

module.exports = {
  getParentBranch,
  ensureBranch,
  updateBranch,
  removeStandaloneBranches,
};

async function getParentBranch(branchName, config) {
  // Check if branch exists
  if ((await config.api.branchExists(branchName)) === false) {
    logger.info(`Branch needs creating`);
    return undefined;
  }
  logger.info(`Branch already exists`);
  // Check if needs rebasing
  if (
    config.rebaseStalePrs ||
    (config.automergeEnabled && config.automergeType === 'branch-push')
  ) {
    const isBranchStale = await config.api.isBranchStale(branchName);
    if (isBranchStale) {
      logger.info(`Branch is stale and needs rebasing`);
      return undefined;
    }
  }

  // Check for existing PR
  const pr = await config.api.getBranchPr(branchName);
  // Decide if we need to rebase
  if (!pr) {
    logger.debug(`No PR found`);
    // We can't tell if this branch can be rebased so better not
    return branchName;
  }
  if (pr.isUnmergeable) {
    logger.debug('PR is unmergeable');
    if (pr.canRebase) {
      logger.info(`Branch is not mergeable and needs rebasing`);
      if (config.isGitLab) {
        logger.info(`Deleting unmergeable branch in order to recreate/rebase`);
        await config.api.deleteBranch(branchName);
      }
      // Setting parentBranch back to undefined means that we'll use the default branch
      return undefined;
    }
    // Don't do anything different, but warn
    logger.warn(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return branchName;
}

// Ensure branch exists with appropriate content
async function ensureBranch(upgrades) {
  logger.trace({ config: upgrades }, 'ensureBranch');
  // Use the first upgrade for all the templates
  const branchName = handlebars.compile(upgrades[0].branchName)(upgrades[0]);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  const parentBranch = await module.exports.getParentBranch(
    branchName,
    upgrades[0]
  );

  const commitMessage = handlebars.compile(upgrades[0].commitMessage)(
    upgrades[0]
  );
  const api = upgrades[0].api;
  const versions = upgrades[0].versions;
  const cacheFolder = upgrades[0].yarnCacheFolder;
  const packageFiles = {};
  const commitFiles = [];
  for (const upgrade of upgrades) {
    if (upgrade.upgradeType === 'lockFileMaintenance') {
      logger.debug('branch lockFileMaintenance');
      try {
        const newYarnLock = await yarn.maintainLockFile(upgrade);
        if (newYarnLock) {
          commitFiles.push(newYarnLock);
        }
      } catch (err) {
        logger.debug(err);
        throw new Error('Could not maintain yarn.lock file');
      }
    } else {
      // See if this is the first time editing this file
      if (!packageFiles[upgrade.packageFile]) {
        // If we are rebasing then existing content will be from master
        packageFiles[upgrade.packageFile] = await api.getFileContent(
          upgrade.packageFile,
          parentBranch
        );
      }
      const newContent = packageJsonHelper.setNewValue(
        packageFiles[upgrade.packageFile],
        upgrade.depType,
        upgrade.depName,
        upgrade.newVersion,
        logger
      );
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
    logger.info(
      `${Object.keys(packageFiles).length} package file(s) need updating.`
    );
    for (const packageFile of Object.keys(packageFiles)) {
      logger.debug(`Adding ${packageFile}`);
      commitFiles.push({
        name: packageFile,
        contents: packageFiles[packageFile],
      });
      try {
        const yarnLockFile = await yarn.getLockFile(
          packageFile,
          packageFiles[packageFile],
          api,
          cacheFolder,
          versions.yarn
        );
        if (yarnLockFile) {
          // Add new yarn.lock file too
          logger.info(`Adding ${yarnLockFile.name}`);
          commitFiles.push(yarnLockFile);
        }
        const packageLockFile = await npm.getLockFile(
          packageFile,
          packageFiles[packageFile],
          api,
          upgrades[0].versions.npm,
          versions.npm
        );
        if (packageLockFile) {
          // Add new package-lock.json file too
          logger.info(`Adding ${packageLockFile.name}`);
          commitFiles.push(packageLockFile);
        }
      } catch (err) {
        logger.info('Could not generate necessary lock file');
        throw err;
      }
    }
  }
  if (commitFiles.length) {
    logger.debug(`${commitFiles.length} file(s) to commit`);
    // API will know whether to create new branch or not
    await api.commitFilesToBranch(
      branchName,
      commitFiles,
      commitMessage,
      parentBranch
    );
  } else {
    logger.debug(`No files to commit`);
  }
  if (!api.branchExists(branchName)) {
    // Return now if no branch exists
    return false;
  }
  const config = upgrades[0];
  if (config.automergeEnabled === false || config.automergeType === 'pr') {
    // No branch automerge
    return true;
  }
  logger.debug('Checking if we can automerge branch');
  const branchStatus = await api.getBranchStatus(branchName);
  if (branchStatus === 'success') {
    logger.info(`Automerging branch`);
    try {
      await api.mergeBranch(branchName, config.automergeType);
    } catch (err) {
      logger.error(`Failed to automerge branch`);
      logger.debug(JSON.stringify(err));
      throw err;
    }
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  // Return true as branch exists
  return true;
}

async function updateBranch(upgrades) {
  await removeStandaloneBranches(upgrades);
  const upgrade0 = upgrades[0];
  // Delete the semanticPrefix for this branch if feature is not enabled
  if (upgrade0.semanticCommits) {
    logger.debug('Branch has semantic commits enabled');
  } else {
    logger.debug('Branch has semantic commits disabled');
    delete upgrade0.semanticPrefix;
  }
  // Use templates to generate strings
  const branchName = handlebars.compile(upgrade0.branchName)(upgrade0);
  const prTitle = handlebars.compile(upgrade0.prTitle)(upgrade0);

  logger = upgrade0.logger.child({
    repository: upgrade0.repository,
    branch: branchName,
  });

  logger.info(
    `Branch has ${upgrades.length} upgrade(s): ${upgrades.map(
      upgrade => upgrade.depName
    )}`
  );

  try {
    if (
      // Groups and lock file maintenance should set this to true
      upgrade0.recreateClosed === false &&
      (await upgrade0.api.checkForClosedPr(branchName, prTitle))
    ) {
      logger.info(`Skipping branch as matching closed PR already existed`);
      return;
    }
    const branchCreated = await module.exports.ensureBranch(upgrades);
    if (branchCreated) {
      const pr = await prWorker.ensurePr(upgrades, logger);
      if (pr) {
        await prWorker.checkAutoMerge(pr, upgrade0, logger);
      }
    }
  } catch (err) {
    logger.error(`Error updating branch: ${err.message}`);
    logger.debug(JSON.stringify(err));
    // Don't throw here - we don't want to stop the other renovations
  }
}

async function removeStandaloneBranches(upgrades) {
  if (upgrades.length <= 1) {
    return;
  }
  if (upgrades[0].upgradeType === 'lockFileMaintenance') {
    return;
  }
  for (const upgrade of upgrades) {
    const standaloneBranchName = handlebars.compile(upgrade.branchName)(
      upgrade
    );
    upgrade.logger.debug(`Need to delete branch ${standaloneBranchName}`);
    try {
      await upgrade.api.deleteBranch(standaloneBranchName);
    } catch (err) {
      upgrade.logger.debug(`Couldn't delete branch ${standaloneBranchName}`);
    }
    // Rename to group branchName
    upgrade.branchName = upgrade.groupBranchName;
  }
}
