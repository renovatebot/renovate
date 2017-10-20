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
  let dependencies = config.upgrades
    .map(upgrade => upgrade.depName)
    .filter(v => v); // remove nulls (happens for lock file maintenance)
  // remove duplicates
  dependencies = dependencies.filter(
    (item, index) => dependencies.indexOf(item) === index
  );
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
      logger.info(
        { prTitle: config.prTitle },
        'Closed PR already exists. Skipping branch.'
      );
      const subject = 'Renovate Ignore Notification';
      let content;
      if (config.isMajor) {
        content = `As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future ${config.newVersionMajor}.x releases. However, if you upgrade to ${config.newVersionMajor}.x manually then Renovate will then reenable updates for minor and patch updates automatically.`;
      } else if (config.isDigest) {
        content = `As this PR has been closed unmerged, Renovate will ignore this upgrade type and you will not receive PRs for *any* future ${config.depName}:${config.currentTag} digest updates. Digest updates will resume if you update the specified tag at any time.`;
      } else {
        content = `As this PR has been closed unmerged, Renovate will now ignore this update (${config.newVersion}). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
      }
      content +=
        '\n\nIf this PR was closed by mistake or you changed your mind, you can simply reopen or rename it to reactivate Renovate for this dependency version.';
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
      const topic = 'Lock file problem';
      if (config.lockFileErrors && config.lockFileErrors.length) {
        logger.warn(
          { lockFileErrors: config.lockFileErrors },
          'lockFileErrors'
        );
        let content = `Renovate failed when attempting to generate `;
        content +=
          config.lockFileErrors.length > 1 ? 'lock files' : 'a lock file';
        content +=
          '. This is usually happens when you have private modules but have not added configuration for [private module support](https://renovateapp.com/docs/deep-dives/private-modules). It is strongly recommended that you do not merge this PR as-is.';
        content +=
          '\n\nRenovate **will not retry** generating a lockfile for this PR unless either (a) the `package.json` in this branch needs updating, or (b) ';
        if (config.recreateClosed) {
          content +=
            'you manually delete this PR so that it can be regenerated.';
        } else {
          content +=
            'you rename then delete this PR unmerged, so that it can be regenerated.';
        }
        content += '\n\nThe output from `stderr` is included below:';
        const subtopics = [];
        config.lockFileErrors.forEach(error => {
          subtopics.push({
            topic: error.lockFile,
            content: `\`\`\`\n${error.stderr}\n\`\`\``,
          });
        });
        await config.api.ensureComment(pr.number, topic, content, subtopics);
      } else {
        await config.api.ensureCommentRemoval(pr.number, topic);
        const prAutomerged = await prWorker.checkAutoMerge(pr, config);
        if (prAutomerged) {
          return 'automerged';
        }
      }
    }
  } catch (err) {
    logger.error({ err }, `Error ensuring PR: ${err.message}`);
    // Don't throw here - we don't want to stop the other renovations
  }
  return 'done';
}
