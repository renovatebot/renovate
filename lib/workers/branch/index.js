const schedule = require('./schedule');
const { getUpdatedPackageFiles } = require('./package-files');
const { getUpdatedLockFiles } = require('./lock-files');
const { commitFilesToBranch } = require('./commit');
const { getParentBranch } = require('./parent');
const { tryBranchAutomerge } = require('./automerge');
const { setUnpublishable } = require('./status-checks');
const { prAlreadyExisted } = require('./check-existing');
const prWorker = require('../pr');

const { isScheduledNow } = schedule;

module.exports = {
  processBranch,
};

async function processBranch(branchConfig) {
  const config = { ...branchConfig };
  const dependencies = config.upgrades
    .map(upgrade => upgrade.depName)
    .filter(v => v); // remove nulls (happens for lock file maintenance)
  const logger = config.logger.child({
    repository: config.repository,
    branch: config.branchName,
    dependencies,
  });
  config.logger = logger;
  logger.trace({ config }, 'processBranch');
  try {
    // Check schedule
    if (!isScheduledNow(config)) {
      logger.info('Skipping branch as it is not scheduled');
      return;
    }

    logger.info(`Branch has ${dependencies.length} upgrade(s)`);

    if (await prAlreadyExisted(config)) {
      logger.info('Closed PR already exists. Skipping branch.');
      return;
    }
    config.parentBranch = await getParentBranch(config);
    logger.debug(`Using parentBranch: ${config.parentBranch}`);
    config.updatedPackageFiles = await getUpdatedPackageFiles(config);
    if (config.updatedPackageFiles.length) {
      logger.debug(
        { updatedPackageFiles: config.updatedPackageFiles },
        `Updated ${config.updatedPackageFiles.length} package files`
      );
    } else {
      logger.debug('No package files need updating');
    }
    Object.assign(config, await getUpdatedLockFiles(config));
    if (config.lockFileError) {
      throw new Error('lockFileError');
    }
    if (config.updatedLockFiles.length) {
      logger.debug(
        { updatedLockFiles: config.updatedLockFiles },
        `Updated ${config.updatedLockFiles.length} lock files`
      );
    } else {
      logger.debug('No updated lock files in branch');
    }
    await commitFilesToBranch(config);

    // Return now if no branch exists
    if ((await config.api.branchExists(config.branchName)) === false) {
      logger.debug('Branch does not exist - returning');
      return;
    }

    // Set branch statuses
    await setUnpublishable(config);

    // Try to automerge branch and finish if successful
    logger.debug('Checking if we should automerge the branch');
    const branchMerged = await tryBranchAutomerge(config);
    if (branchMerged) {
      logger.debug('Branch is automerged - returning');
      return;
    }
  } catch (err) {
    if (err.message !== 'lockFileError') {
      logger.error({ err }, `Error updating branch: ${err.message}`);
    } else {
      logger.info('Error updating branch');
    }
    // Don't throw here - we don't want to stop the other renovations
    return;
  }
  try {
    logger.debug('Ensuring PR');
    logger.trace({ config }, 'test');
    const pr = await prWorker.ensurePr(config);
    // TODO: ensurePr should check for automerge itself
    if (pr) {
      await prWorker.checkAutoMerge(pr, config);
    }
  } catch (err) {
    logger.error({ err }, `Error ensuring PR: ${err.message}`);
  }

  // Don't throw here - we don't want to stop the other renovations
}
