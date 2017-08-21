const handlebars = require('handlebars');
const packageJsonHelper = require('./package-json');
const npm = require('./npm');
const yarn = require('./yarn');
const schedule = require('./schedule');
const prWorker = require('../pr');
let logger = require('../../logger');

module.exports = {
  checkStale,
  getParentBranch,
  ensureBranch,
  processBranchUpgrades,
};

function checkStale(config) {
  // Manually configured
  if (config.rebaseStalePrs || config.repoForceRebase) {
    return true;
  }
  // Commits can't be pushed to a branch unless they are up-to-date
  if (config.automerge && config.automergeType === 'branch-push') {
    return true;
  }
  return false;
}

async function getParentBranch(branchName, config) {
  // Check if branch exists
  const branchExists = await config.api.branchExists(branchName);
  if (!branchExists) {
    logger.info(`Branch needs creating`);
    return undefined;
  }
  logger.info(`Branch already exists`);

  // Check for existing PR
  const pr = await config.api.getBranchPr(branchName);

  if (checkStale(config)) {
    const isBranchStale = await config.api.isBranchStale(branchName);
    if (isBranchStale) {
      logger.info(`Branch is stale and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (!pr || pr.canRebase) {
        return undefined;
      }
      // TODO: Warn here so that it appears in PR body
      logger.info('Cannot rebase branch');
      return branchName;
    }
  }

  // Now check if PR is unmergeable. If so then we also rebase
  if (pr && pr.isUnmergeable) {
    logger.debug('PR is unmergeable');
    if (pr.canRebase) {
      logger.info(`Branch is not mergeable and needs rebasing`);
      // TODO: Move this down to api library
      if (config.isGitLab) {
        logger.info(`Deleting unmergeable branch in order to recreate/rebase`);
        await config.api.deleteBranch(branchName);
      }
      // Setting parentBranch back to undefined means that we'll use the default branch
      return undefined;
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR
    logger.warn(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return branchName;
}

// Ensure branch exists with appropriate content
async function ensureBranch(config) {
  logger.trace({ config }, 'ensureBranch');
  // Use the first upgrade for all the templates
  const branchName = handlebars.compile(config.branchName)(config);
  // parentBranch is the branch we will base off
  // If undefined, this will mean the defaultBranch
  const parentBranch = await module.exports.getParentBranch(branchName, config);

  let commitMessage = handlebars.compile(config.commitMessage)(config);
  if (config.semanticCommits) {
    commitMessage = `${config.semanticPrefix} ${commitMessage.toLowerCase()}`;
  }
  const api = config.api;
  const packageFiles = {};
  const commitFiles = [];
  let unpublishable;
  for (const upgrade of config.upgrades) {
    if (typeof upgrade.unpublishable !== 'undefined') {
      if (typeof unpublishable !== 'undefined') {
        unpublishable = unpublishable && upgrade.unpublishable;
      } else {
        unpublishable = upgrade.unpublishable;
      }
    }
    if (upgrade.type === 'lockFileMaintenance') {
      logger.debug('branch lockFileMaintenance');
      try {
        if (upgrade.hasYarnLock) {
          const newYarnLock = await yarn.maintainLockFile(upgrade);
          if (newYarnLock) {
            commitFiles.push(newYarnLock);
          }
        }
        if (upgrade.hasPackageLock) {
          const newPackageLock = await npm.maintainLockFile(upgrade);
          if (newPackageLock) {
            commitFiles.push(newPackageLock);
          }
        }
      } catch (err) {
        logger.debug({ err }, 'Error maintaining lock files');
        throw new Error('Error maintaining lock files');
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
          logger
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
          config.versions.npm,
          logger
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
  if ((await api.branchExists(branchName)) === false) {
    // Return now if no branch exists
    return false;
  }
  const context = 'renovate/unpublish-safe';
  const existingState = await api.getBranchStatusCheck(branchName, context);
  // If status check was enabled and then is disabled, any "pending" status check needs to be set to "success"
  const removeStatusCheck =
    existingState === 'pending' && !config.unpublishSafe;
  if (
    (config.unpublishSafe || removeStatusCheck) &&
    typeof unpublishable !== 'undefined'
  ) {
    // Set unpublishable status check
    const state = unpublishable || removeStatusCheck ? 'success' : 'pending';
    const description = unpublishable
      ? 'Packages are at least 24 hours old'
      : 'Packages < 24 hours old can be unpublished';
    // Check if state needs setting
    if (existingState === state) {
      logger.debug('Status check is already up-to-date');
    } else {
      logger.debug(`Updating status check state to ${state}`);
      await api.setBranchStatus(
        branchName,
        context,
        description,
        state,
        'https://github.com/singapore/renovate/blob/master/docs/status-checks.md#unpublish-safe'
      );
    }
  }
  if (config.automerge === false || config.automergeType === 'pr') {
    // No branch automerge
    return true;
  }
  logger.debug('Checking if we can automerge branch');
  const branchStatus = await api.getBranchStatus(
    branchName,
    config.requiredStatusChecks
  );
  if (branchStatus === 'success') {
    logger.info(`Automerging branch`);
    try {
      await api.mergeBranch(branchName, config.automergeType);
      return false; // Branch no longer exists
    } catch (err) {
      logger.error({ err }, `Failed to automerge branch`);
      throw err;
    }
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  // Return true as branch exists
  return true;
}

async function processBranchUpgrades(branchUpgrades, errors, warnings) {
  logger = branchUpgrades.logger || logger;
  const config = { ...branchUpgrades };
  logger = logger.child({
    repository: config.repository,
    branch: config.branchName,
  });
  config.logger = logger;
  logger.trace({ config: branchUpgrades }, 'processBranchUpgrades');
  // Check schedule
  if (
    config.schedule &&
    config.schedule.length &&
    schedule.isScheduledNow(config) === false
  ) {
    logger.info('Skipping branch as it is not scheduled');
    return;
  }

  const packageNames = config.upgrades.map(upgrade => upgrade.depName);
  logger.info(`Branch has ${packageNames.length} upgrade(s): ${packageNames}`);

  try {
    // Groups and lock file maintenance should set this to true
    if (config.recreateClosed === false) {
      if (
        // Check for current PR title format
        await config.api.checkForClosedPr(config.branchName, config.prTitle)
      ) {
        return;
      }
      // Check for legacy PR title format
      const legacyPrTitle = config.prTitle
        .replace(/to v(\d+)$/, 'to version $1.x') // Major
        .replace(/to v(\d+)/, 'to version $1'); // Non-major
      if (await config.api.checkForClosedPr(config.branchName, legacyPrTitle)) {
        return;
      }
    }
    const branchCreated = await module.exports.ensureBranch(config);
    if (branchCreated) {
      const pr = await prWorker.ensurePr(config, logger, errors, warnings);
      if (pr) {
        await prWorker.checkAutoMerge(pr, config, logger);
      }
    }
  } catch (err) {
    if (err.message !== 'Error generating lock file') {
      logger.error({ err }, `Error updating branch: ${err.message}`);
    } else {
      logger.info('Error updating branch');
    }
    // Don't throw here - we don't want to stop the other renovations
  }
}
