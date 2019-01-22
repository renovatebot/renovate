const changelogHelper = require('./changelog');
const { getPrBody } = require('./pr-body');

module.exports = {
  ensurePr,
  checkAutoMerge,
};
// Ensures that PR exists with matching title/body
async function ensurePr(prConfig) {
  const config = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, prTitle, upgrades } = config;
  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(branchName);
  if (existingPr) {
    logger.debug('Found existing PR');
  }
  config.upgrades = [];

  if (config.lockFileErrors && config.lockFileErrors.length) {
    logger.debug('Forcing PR because of lock file errors');
    config.forcePr = true;
  }

  let branchStatus;
  async function getBranchStatus() {
    if (!branchStatus) {
      branchStatus = await platform.getBranchStatus(
        branchName,
        config.requiredStatusChecks
      );
      logger.debug({ branchStatus, branchName }, 'getBranchStatus() result');
    }
    return branchStatus;
  }

  // Only create a PR if a branch automerge has failed
  if (
    config.automerge === true &&
    config.automergeType.startsWith('branch') &&
    !config.forcePr
  ) {
    logger.debug(
      `Branch is configured for branch automerge, branch status) is: ${await getBranchStatus()}`
    );
    if (
      (await getBranchStatus()) === 'pending' ||
      (await getBranchStatus()) === 'running'
    ) {
      logger.debug('Checking how long this branch has been pending');
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (elapsedHours >= config.prNotPendingHours) {
        logger.info('Branch exceeds prNotPending hours - forcing PR creation');
        config.forcePr = true;
      }
    }
    if (config.forcePr || (await getBranchStatus()) === 'failure') {
      logger.debug(`Branch tests failed, so will create PR`);
    } else {
      return null;
    }
  }
  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    if ((await getBranchStatus()) !== 'success') {
      logger.debug(
        `Branch status is "${await getBranchStatus()}" - not creating PR`
      );
      return null;
    }
    logger.debug('Branch status success');
  } else if (
    config.prCreation === 'not-pending' &&
    !existingPr &&
    !config.forcePr
  ) {
    logger.debug('Checking branch combined status');
    if (
      (await getBranchStatus()) === 'pending' ||
      (await getBranchStatus()) === 'running'
    ) {
      logger.debug(
        `Branch status is "${await getBranchStatus()}" - checking timeout`
      );
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (elapsedHours < config.prNotPendingHours) {
        logger.debug(
          `Branch is ${elapsedHours} hours old - skipping PR creation`
        );
        return null;
      }
      logger.debug(
        `prNotPendingHours=${
          config.prNotPendingHours
        } threshold hit - creating PR`
      );
    }
    logger.debug('Branch status success');
  }

  const processedUpgrades = [];
  const commitRepos = [];

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depType}-${upgrade.depName}-${
      upgrade.manager
    }-${upgrade.fromVersion || upgrade.currentValue}-${upgrade.toVersion}`;
    if (processedUpgrades.includes(upgradeKey)) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);
    upgrade.hasUrls = !!(upgrade.sourceUrl || upgrade.homepage);

    const logJSON = await changelogHelper.getChangeLogJSON({
      manager: upgrade.manager,
      versionScheme: upgrade.versionScheme,
      depType: upgrade.depType,
      depName: upgrade.depName,
      fromVersion: upgrade.fromVersion,
      toVersion: upgrade.toVersion,
      sourceUrl: upgrade.sourceUrl,
      releases: upgrade.releases,
    });

    if (logJSON) {
      upgrade.githubName = logJSON.project ? logJSON.project.github : undefined;
      upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
      upgrade.releases = [];
      if (
        upgrade.hasReleaseNotes &&
        upgrade.githubName &&
        !commitRepos.includes(upgrade.githubName)
      ) {
        commitRepos.push(upgrade.githubName);
        logJSON.versions.forEach(version => {
          const release = { ...version };
          upgrade.releases.push(release);
        });
      }
    }
    config.upgrades.push(upgrade);
  }

  // Update the config object
  Object.assign(config, upgrades[0]);
  config.hasReleaseNotes = config.upgrades.some(upg => upg.hasReleaseNotes);

  const releaseNoteRepos = [];
  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes) {
      if (releaseNoteRepos.includes(upgrade.sourceUrl)) {
        logger.debug(
          { depName: upgrade.depName },
          'Removing duplicate release notes'
        );
        upgrade.hasReleaseNotes = false;
      } else {
        releaseNoteRepos.push(upgrade.sourceUrl);
      }
    }
  }

  const prBody = await getPrBody(config);

  try {
    if (existingPr) {
      logger.debug('Processing existing PR');
      // istanbul ignore if
      if (config.automerge && (await getBranchStatus()) === 'failure') {
        logger.debug(`Setting assignees and reviewers as status checks failed`);
        await addAssigneesReviewers(config, existingPr);
      }
      // Check if existing PR needs updating
      const reviewableIndex = existingPr.body.indexOf(
        '<!-- Reviewable:start -->'
      );
      let existingPrBody = existingPr.body;
      if (reviewableIndex > -1) {
        logger.debug('Stripping Reviewable content');
        existingPrBody = existingPrBody.slice(0, reviewableIndex);
      }
      existingPrBody = existingPrBody.trim();
      if (
        existingPr.title === prTitle &&
        noWhitespace(existingPrBody) === noWhitespace(prBody)
      ) {
        logger.debug(`${existingPr.displayNumber} does not need updating`);
        return existingPr;
      }
      // PR must need updating
      if (existingPr.title !== prTitle) {
        logger.info(
          {
            branchName,
            oldPrTitle: existingPr.title,
            newPrTitle: prTitle,
          },
          'PR title changed'
        );
      } else if (!config.committedFiles) {
        logger.debug(
          {
            prTitle,
            oldPrBody: existingPrBody,
            newPrBody: prBody,
          },
          'PR body changed'
        );
      }
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would update PR #' + existingPr.number);
      } else {
        await platform.updatePr(existingPr.number, prTitle, prBody);
        logger.info(
          { committedFiles: config.committedFiles, pr: existingPr.number },
          `PR updated`
        );
      }
      return existingPr;
    }
    logger.debug({ branch: branchName, prTitle }, `Creating PR`);
    // istanbul ignore if
    if (config.updateType === 'rollback') {
      logger.info('Creating Rollback PR');
    }
    let pr;
    try {
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would create PR: ' + prTitle);
        pr = { number: 0, displayNumber: 'Dry run PR' };
      } else {
        pr = await platform.createPr(
          branchName,
          prTitle,
          prBody,
          config.labels,
          false,
          config.statusCheckVerify
        );
        logger.info({ branch: branchName, pr: pr.number }, 'PR created');
      }
    } catch (err) {
      logger.warn({ err }, `Failed to create PR`);
      if (err.message === 'Validation Failed (422)') {
        logger.info({ branch: branchName }, 'Deleting invalid branch');
        // istanbul ignore if
        if (config.dryRun) {
          logger.info('DRY-RUN: Would delete branch: ' + config.branchName);
        } else {
          await platform.deleteBranch(branchName);
        }
      }
      // istanbul ignore if
      if (err.statusCode === 502) {
        logger.info(
          { branch: branchName },
          'Deleting branch due to server error'
        );
        // istanbul ignore if
        if (config.dryRun) {
          logger.info('DRY-RUN: Would delete branch: ' + config.branchName);
        } else {
          await platform.deleteBranch(branchName);
        }
      }
      return null;
    }
    if (
      config.branchAutomergeFailureMessage &&
      !config.suppressNotifications.includes('branchAutomergeFailure')
    ) {
      const subject = 'Branch automerge failure';
      let content =
        'This PR was configured for branch automerge, however this is not possible so it has been raised as a PR instead.';
      if (config.branchAutomergeFailureMessage === 'branch status error') {
        content += '\n___\n * Branch has one or more failed status checks';
      }
      logger.info('Adding branch automerge failure message to PR');
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('Would add comment to PR #' + pr.number);
      } else {
        await platform.ensureComment(pr.number, subject, content);
      }
    }
    // Skip assign and review if automerging PR
    if (config.automerge && (await getBranchStatus()) !== 'failure') {
      logger.debug(
        `Skipping assignees and reviewers as automerge=${config.automerge}`
      );
    } else {
      await addAssigneesReviewers(config, pr);
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (err) {
    // istanbul ignore if
    if (
      err.message === 'rate-limit-exceeded' ||
      err.message === 'platform-failure' ||
      err.message === 'integration-unauthorized'
    ) {
      logger.debug('Passing error up');
      throw err;
    }
    logger.error({ err }, 'Failed to ensure PR:', err);
  }
  return null;
}

async function addAssigneesReviewers(config, pr) {
  if (config.assignees.length > 0) {
    try {
      const assignees = config.assignees.map(assignee =>
        assignee.length && assignee[0] === '@' ? assignee.slice(1) : assignee
      );
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would add assignees to PR #', pr.number);
      } else {
        await platform.addAssignees(pr.number, assignees);
        logger.info({ assignees: config.assignees }, 'Added assignees');
      }
    } catch (err) {
      logger.info(
        { assignees: config.assignees, err },
        'Failed to add assignees'
      );
    }
  }
  if (config.reviewers.length > 0) {
    try {
      const reviewers = config.reviewers.map(reviewer =>
        reviewer.length && reviewer[0] === '@' ? reviewer.slice(1) : reviewer
      );
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would add assignees to PR #', pr.number);
      } else {
        await platform.addReviewers(pr.number, reviewers);
        logger.info({ reviewers: config.reviewers }, 'Added reviewers');
      }
    } catch (err) {
      logger.info(
        { assignees: config.assignees, err },
        'Failed to add reviewers'
      );
    }
  }
}

async function checkAutoMerge(pr, config) {
  logger.trace({ config }, 'checkAutoMerge');
  const {
    branchName,
    automerge,
    automergeType,
    automergeComment,
    requiredStatusChecks,
  } = config;
  logger.debug(
    { automerge, automergeType, automergeComment },
    `Checking #${pr.number} for automerge`
  );
  if (automerge) {
    logger.debug('PR is configured for automerge');
    // Return if PR not ready for automerge
    if (pr.isConflicted) {
      logger.info('PR is conflicted');
      logger.debug({ pr });
      return false;
    }
    if (requiredStatusChecks && pr.canMerge !== true) {
      logger.info('PR is not ready for merge');
      return false;
    }
    const branchStatus = await platform.getBranchStatus(
      branchName,
      requiredStatusChecks
    );
    if (branchStatus !== 'success') {
      logger.info(
        `PR is not ready for merge (branch status is ${branchStatus})`
      );
      return false;
    }
    // Check if it's been touched
    if (!pr.canRebase) {
      logger.info('PR is ready for automerge but has been modified');
      return false;
    }
    if (automergeType === 'pr-comment') {
      logger.info(`Applying automerge comment: ${automergeComment}`);
      // istanbul ignore if
      if (config.dryRun) {
        logger.info(
          'DRY-RUN: Would add PR automerge comment to PR #' + pr.number
        );
        return false;
      }
      return platform.ensureComment(pr.number, null, automergeComment);
    }
    // Let's merge this
    logger.debug(`Automerging #${pr.number}`);
    // istanbul ignore if
    if (config.dryRun) {
      logger.info('DRY-RUN: Would merge PR #' + pr.number);
      return false;
    }
    const res = await platform.mergePr(pr.number, branchName);
    if (res) {
      logger.info({ pr: pr.number }, 'PR automerged');
    }
    return res;
  }
  logger.debug('No automerge');
  return false;
}

function noWhitespace(input) {
  return input.replace(/\r?\n|\r|\s/g, '');
}
