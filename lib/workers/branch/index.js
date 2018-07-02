const schedule = require('./schedule');
const { getUpdatedPackageFiles } = require('./get-updated');
const { getAdditionalFiles } = require('../../manager/npm/post-update');
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

async function processBranch(branchConfig, packageFiles) {
  logger.debug(`processBranch with ${branchConfig.upgrades.length} upgrades`);
  const config = { ...branchConfig };
  const dependencies = config.upgrades
    .map(upgrade => upgrade.depName)
    .filter(v => v) // remove nulls (happens for lock file maintenance)
    .filter((value, i, list) => list.indexOf(value) === i); // remove duplicates
  logger.setMeta({
    repository: config.repository,
    branch: config.branchName,
    dependencies,
  });
  logger.debug('processBranch()');
  logger.trace({ config });
  await platform.setBaseBranch(config.baseBranch);
  const branchExists = await platform.branchExists(config.branchName);
  logger.debug(`branchExists=${branchExists}`);
  if (!branchExists && config.prHourlyLimitReached) {
    logger.info('Reached PR creation limit - skipping branch creation');
    return 'pr-hourly-limit-reached';
  }
  try {
    logger.info(
      `Branch has ${dependencies ? dependencies.length : 0} upgrade(s)`
    );

    // Check if branch already existed
    const existingPr = await prAlreadyExisted(config);
    if (existingPr) {
      logger.info(
        { prTitle: config.prTitle },
        'Closed PR already exists. Skipping branch.'
      );
      if (existingPr.state === 'closed') {
        const subject = 'Renovate Ignore Notification';
        let content;
        if (config.type === 'major') {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future ${
            config.newMajor
          }.x releases. However, if you upgrade to ${
            config.newMajor
          }.x manually then Renovate will then reenable updates for minor and patch updates automatically.`;
        } else if (config.type === 'digest') {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade type and you will not receive PRs for *any* future ${
            config.depName
          }:${
            config.currentTag
          } digest updates. Digest updates will resume if you update the specified tag at any time.`;
        } else {
          content = `As this PR has been closed unmerged, Renovate will now ignore this update (${
            config.newValue
          }). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
        }
        content +=
          '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
        await platform.ensureComment(existingPr.number, subject, content);
        if (branchExists) {
          await platform.deleteBranch(config.branchName);
        }
      } else if (existingPr.state === 'merged') {
        logger.info(
          { pr: existingPr.number },
          'Merged PR is blocking this branch'
        );
      }
      return 'already-existed';
    }
    if (branchExists) {
      logger.debug('Checking if PR has been edited');
      const branchPr = await platform.getBranchPr(config.branchName);
      if (branchPr) {
        logger.debug('Found existing branch PR');
        if (branchPr.state !== 'open') {
          logger.info(
            'PR has been closed or merged since this run started - aborting'
          );
          throw new Error('repository-changed');
        }
        if (!branchPr.canRebase) {
          const subject = 'PR has been edited';
          logger.info(subject);
          let content =
            'As this PR has been edited, Renovate will stop updating it in order to not cause any conflicts or other problems.';
          content +=
            ' If you wish to abandon your edits and have Renovate recreate this PR then you should rename this PR and then close it.';
          await platform.ensureComment(branchPr.number, subject, content);
          return 'pr-edited';
        }
      }
    }

    // Check schedule
    config.isScheduledNow = isScheduledNow(config);
    if (!config.isScheduledNow) {
      if (!branchExists) {
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

    if (
      config.type !== 'lockFileMaintenance' &&
      config.unpublishSafe &&
      config.canBeUnpublished &&
      (config.prCreation === 'not-pending' ||
        config.prCreation === 'status-success')
    ) {
      logger.info(
        'Skipping branch creation due to unpublishSafe + status checks'
      );
      return 'pending';
    }

    Object.assign(config, await getParentBranch(config));
    logger.debug(`Using parentBranch: ${config.parentBranch}`);
    Object.assign(config, await getUpdatedPackageFiles(config));
    if (config.updatedPackageFiles && config.updatedPackageFiles.length) {
      logger.debug(
        `Updated ${config.updatedPackageFiles.length} package files`
      );
    } else {
      logger.debug('No package files need updating');
    }
    Object.assign(config, await getAdditionalFiles(config, packageFiles));
    if (config.updatedLockFiles && config.updatedLockFiles.length) {
      logger.debug(
        { updatedLockFiles: config.updatedLockFiles.map(f => f.name) },
        `Updated ${config.updatedLockFiles.length} lock files`
      );
    } else {
      logger.debug('No updated lock files in branch');
    }

    const committedFiles = await commitFilesToBranch(config);
    // istanbul ignore if
    if (
      config.type === 'lockFileMaintenance' &&
      !committedFiles &&
      !config.parentBranch &&
      branchExists
    ) {
      logger.info(
        'Deleting lock file maintenance branch as master lock file no longer needs updating'
      );
      await platform.deleteBranch(config.branchName);
      return 'done';
    }
    if (!(committedFiles || branchExists)) {
      return 'no-work';
    }

    // Set branch statuses
    await setUnpublishable(config);

    // Try to automerge branch and finish if successful, but only if branch already existed before this run
    if (branchExists || !config.requiresStatusChecks) {
      const mergeStatus = await tryBranchAutomerge(config);
      logger.debug(`mergeStatus=${mergeStatus}`);
      if (mergeStatus === 'automerged') {
        logger.debug('Branch is automerged - returning');
        return 'automerged';
      } else if (
        mergeStatus === 'automerge aborted - PR exists' ||
        mergeStatus === 'branch status error' ||
        mergeStatus === 'failed'
      ) {
        logger.info({ mergeStatus }, 'Branch automerge not possible');
        config.forcePr = true;
        config.branchAutomergeFailureMessage = mergeStatus;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message === 'rate-limit-exceeded') {
      logger.debug('Passing rate-limit-exceeded error up');
      throw err;
    }
    if (err.message === 'repository-changed') {
      logger.debug('Passing repository-changed error up');
      throw err;
    }
    if (err.message === 'bad-credentials') {
      logger.debug('Passing bad-credentials error up');
      throw err;
    }
    if (err.message === 'lockfile-error') {
      logger.info('Lock file error');
      throw err;
    }
    if (err.message !== 'registry-failure') {
      logger.error({ err }, `Error updating branch: ${err.message}`);
    }
    // Don't throw here - we don't want to stop the other renovations
    return 'error';
  }
  try {
    logger.debug('Ensuring PR');
    logger.debug(
      `There are ${config.errors.length} errors and ${
        config.warnings.length
      } warnings`
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
          '. This is usually happens when you have private modules but have not added configuration for [private module support](https://renovatebot.com/docs/deep-dives/private-modules). It is strongly recommended that you do not merge this PR as-is.';
        content +=
          '\n\nRenovate **will not retry** generating a lockfile for this PR unless either (a) the `package.json` in this branch needs updating, or (b) ';
        if (config.recreateClosed) {
          content +=
            'you manually delete this PR so that it can be regenerated.';
        } else {
          content +=
            'you rename then delete this PR unmerged, so that it can be regenerated.';
        }
        content += '\n\nThe output from `stderr` is included below:\n\n';
        config.lockFileErrors.forEach(error => {
          content += `##### ${error.lockFile}\n\n`;
          content += `\`\`\`\n${error.stderr}\n\`\`\`\n\n`;
        });
        await platform.ensureComment(pr.number, topic, content);
      } else {
        if (config.updatedLockFiles && config.updatedLockFiles.length) {
          await platform.ensureCommentRemoval(pr.number, topic);
        }
        const prAutomerged = await prWorker.checkAutoMerge(pr, config);
        if (prAutomerged) {
          return 'automerged';
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message === 'rate-limit-exceeded') {
      logger.debug('Passing rate-limit-exceeded error up');
      throw err;
    }
    if (err.message && err.message.includes('Bad credentials')) {
      logger.debug('Passing Bad credentials error up');
      throw err;
    }
    // Otherwise don't throw here - we don't want to stop the other renovations
    logger.error({ err }, `Error ensuring PR: ${err.message}`);
  }
  if (!branchExists) {
    return 'pr-created';
  }
  return 'done';
}
