const schedule = require('./schedule');
const { getUpdatedPackageFiles } = require('../../manager');
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
    let pr = await prAlreadyExisted(config);
    if (pr) {
      logger.info(
        { prTitle: config.prTitle },
        'Closed PR already exists. Skipping branch.'
      );
      if (pr.state === 'closed') {
        const subject = 'Renovate Ignore Notification';
        let content;
        if (config.isMajor) {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future ${
            config.newVersionMajor
          }.x releases. However, if you upgrade to ${
            config.newVersionMajor
          }.x manually then Renovate will then reenable updates for minor and patch updates automatically.`;
        } else if (config.isDigest) {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade type and you will not receive PRs for *any* future ${
            config.depName
          }:${
            config.currentTag
          } digest updates. Digest updates will resume if you update the specified tag at any time.`;
        } else {
          content = `As this PR has been closed unmerged, Renovate will now ignore this update (${
            config.newVersion
          }). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
        }
        content +=
          '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
        await platform.ensureComment(pr.number, subject, content);
        if (branchExists) {
          await platform.deleteBranch(config.branchName);
        }
      } else if (pr.state === 'merged') {
        logger.info({ pr: pr.number }, 'Merged PR is blocking this branch');
      }
      return 'already-existed';
    }
    if (branchExists) {
      logger.debug('Checking if PR has been edited');
      pr = await platform.findPr(config.branchName, config.prTitle, 'open');
    }
    if (pr) {
      logger.debug({ pr }, 'Found existing PR');
      pr = await platform.getPr(pr.number);
      if (pr.state.startsWith('open')) {
        logger.debug('Existing PR is open');
        if (!pr.canRebase) {
          const subject = 'PR has been edited';
          logger.info(subject);
          let content =
            'As this PR has been edited, Renovate will stop updating it in order to not cause any conflicts or other problems.';
          content +=
            ' If you wish to abandon your edits and have Renovate recreate this PR then you should rename this PR and then close it.';
          await platform.ensureComment(pr.number, subject, content);
          return 'pr-edited';
        }
      } else {
        logger.info('PR state is not open - aborting');
        logger.debug({ pr });
        return 'pr-closed';
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

    Object.assign(config, await getParentBranch(config));
    logger.debug(`Using parentBranch: ${config.parentBranch}`);
    Object.assign(config, await getUpdatedPackageFiles(config));
    if (config.updatedPackageFiles && config.updatedPackageFiles.length) {
      logger.debug(
        { updatedPackageFiles: config.updatedPackageFiles },
        `Updated ${config.updatedPackageFiles.length} package files`
      );
    } else {
      logger.debug('No package files need updating');
    }
    Object.assign(config, await getUpdatedLockFiles(config));
    if (config.updatedLockFiles && config.updatedLockFiles.length) {
      logger.debug(
        { updatedLockFiles: config.updatedLockFiles.map(f => f.name) },
        `Updated ${config.updatedLockFiles.length} lock files`
      );
    } else {
      logger.debug('No updated lock files in branch');
    }

    const committedFiles = await commitFilesToBranch(config);
    if (!(committedFiles || branchExists)) {
      return 'no-work';
    }

    // Set branch statuses
    await setUnpublishable(config);

    // Try to automerge branch and finish if successful
    logger.debug('Checking if we should automerge the branch');
    const mergeStatus = await tryBranchAutomerge(config);
    if (mergeStatus === 'automerged') {
      logger.debug('Branch is automerged - returning');
      return 'automerged';
    } else if (
      mergeStatus === 'automerge aborted - PR exists' ||
      mergeStatus === 'failed'
    ) {
      logger.info({ mergeStatus }, 'Branch automerge not possible');
      config.forcePr = true;
    }
  } catch (err) {
    // istanbul ignore if
    if (err.message === 'repository-changed') {
      logger.debug('Passing repository-changed error up');
      throw err;
    }
    logger.error({ err }, `Error updating branch: ${err.message}`);
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
  } catch (err) {
    logger.error({ err }, `Error ensuring PR: ${err.message}`);
    // Don't throw here - we don't want to stop the other renovations
  }
  if (!branchExists) {
    return 'pr-created';
  }
  return 'done';
}
