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
    config.isScheduledNow = isScheduledNow(config);
    if (!config.isScheduledNow) {
      if (!await config.api.branchExists(config.branchName)) {
        logger.info('Skipping branch creation as not within schedule');
        return 'not-scheduled';
      }
      if (config.updateNotScheduled === false) {
        logger.debug('Skipping branch update as not within schedule');
        return 'not-scheduled';
      }
      logger.debug(
        'Branch exists but is not scheduled -- will update if necessary'
      );
    }

    logger.info(`Branch has ${dependencies.length} upgrade(s)`);

    const pr = await prAlreadyExisted(config);
    if (pr) {
      logger.info('Closed PR already exists. Skipping branch.');
      const subject = 'Renovate Ignore Notification';
      let content =
        'Renovate will now ignore this PR, as it has been closed. If this was a mistake or you changed your mind, you can simply reopen or rename this PR to reactivate Renovate.';
      if (config.isMajor) {
        content += `\n\nYou will otherwise not receive PRs for any releases of this major version (${config.newVersionMajor}.x) unless you upgrade it manually yourself. If Renovate later detects that it has been manuall upgraded, it will resume creating PRs for minor and patch upgrades and you do not need to reopen this PR.`;
      } else {
        content += `\n\n**Note**: The ignore applies only to this specific version (${config.newVersion}), so you will still receive a PR once a newer version is released. If you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
      }
      await config.api.ensureComment(pr.number, subject, content);
      return 'already-existed';
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
      return 'lockFileError';
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
      return 'no-branch';
    }

    // Set branch statuses
    await setUnpublishable(config);

    // Try to automerge branch and finish if successful
    logger.debug('Checking if we should automerge the branch');
    const mergeStatus = await tryBranchAutomerge(config);
    if (mergeStatus === 'automerged') {
      logger.debug('Branch is automerged - returning');
      return 'automerged';
    } else if (mergeStatus === 'failed') {
      config.forcePr = true;
    }
  } catch (err) {
    logger.error({ err }, `Error updating branch: ${err.message}`);
    // Don't throw here - we don't want to stop the other renovations
    return 'error';
  }
  try {
    logger.debug('Ensuring PR');
    logger.debug(
      `There are ${config.errors.length} errors and ${config.warnings
        .length} warnings`
    );
    const pr = await prWorker.ensurePr(config);
    // TODO: ensurePr should check for automerge itself
    if (pr) {
      const prAutomerged = await prWorker.checkAutoMerge(pr, config);
      if (prAutomerged) {
        return 'automerged';
      }
    }
  } catch (err) {
    logger.error({ err }, `Error ensuring PR: ${err.message}`);
    // Don't throw here - we don't want to stop the other renovations
  }
  return 'done';
}
