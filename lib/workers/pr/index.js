const handlebars = require('handlebars');
const changelogHelper = require('./changelog');
const showdown = require('showdown');

const converter = new showdown.Converter();
converter.setFlavor('github');

module.exports = {
  ensurePr,
  checkAutoMerge,
};

// Ensures that PR exists with matching title/body
async function ensurePr(prConfig) {
  const config = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, upgrades } = config;
  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(branchName);
  config.upgrades = [];
  const branchStatus = await platform.getBranchStatus(
    branchName,
    config.requiredStatusChecks
  );

  // Only create a PR if a branch automerge has failed
  if (config.automerge === true && config.automergeType.startsWith('branch')) {
    logger.debug(
      `Branch is configured for branch automerge, branchStatus is: ${branchStatus}`
    );
    if (config.forcePr || branchStatus === 'failure') {
      logger.debug(`Branch tests failed, so will create PR`);
    } else {
      return null;
    }
  }
  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    if (branchStatus !== 'success') {
      logger.debug(`Branch status is "${branchStatus}" - not creating PR`);
      return null;
    }
    logger.debug('Branch status success');
  } else if (config.prCreation === 'not-pending' && !existingPr) {
    logger.debug('Checking branch combined status');
    if (branchStatus === 'pending' || branchStatus === 'running') {
      logger.debug(`Branch status is "${branchStatus}" - checking timeout`);
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

  const issueRe = /([\s(])#(\d+)([)\s]?)/g;

  const commitRepos = [];

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depName}-${upgrade.changeLogFromVersion}-${
      upgrade.changeLogToVersion
    }`;
    if (processedUpgrades.indexOf(upgradeKey) !== -1) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);

    const logJSON = await changelogHelper.getChangeLogJSON(
      upgrade.depName,
      upgrade.changeLogFromVersion,
      upgrade.changeLogToVersion
    );
    if (logJSON) {
      upgrade.githubName = logJSON.project.github;
      upgrade.releases = [];
      if (!commitRepos.includes(upgrade.githubName)) {
        commitRepos.push(upgrade.githubName);
        logJSON.versions.forEach(version => {
          const release = { ...version };
          release.commits = [];
          if (release.changes) {
            release.changes.forEach(change => {
              const commit = { ...change };
              delete commit.date;
              commit.shortSha = change.sha.slice(0, 7);
              commit.url = `${logJSON.project.repository}/commit/${change.sha}`;
              if (change.message) {
                [commit.message] = change.message.split('\n');
                if (!config.isGitHub || config.privateRepo === true) {
                  commit.message = commit.message.replace(
                    issueRe,
                    `$1[#$2](${upgrade.repositoryUrl}/issues/$2)$3`
                  );
                }
              }
              release.commits.push(commit);
            });
          }
          upgrade.releases.push(release);
        });
      }
    }
    config.upgrades.push(upgrade);
  }

  // Update the config object
  Object.assign(config, upgrades[0]);
  if (config.errors && config.errors.length) {
    config.hasErrors = true;
  }
  if (config.warnings && config.warnings.length) {
    config.hasWarnings = true;
  }

  const prTitle = handlebars.compile(config.prTitle)(config);
  let prBody = handlebars.compile(config.prBody)(config);
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  prBody = prBody.replace(/@/g, '@&#8203;');
  // Public GitHub repos need links prevented - see #489
  prBody = prBody.replace(issueRe, '$1#&#8203;$2$3');
  // convert escaped backticks back to `
  const backTickRe = /&#x60;([^/]*?)&#x60;/g;
  prBody = prBody.replace(backTickRe, '`$1`');
  // It would be nice to abstract this to the platform layer but made difficult due to our create/update check
  if (config.isGitLab) {
    // Convert to HTML using GitHub-flavoured markdown as it is more feature-rich than GitLab's flavour
    prBody = converter

      .makeHtml(prBody)
      .replace(/<\/?h4[^>]*>/g, '**') // See #954
      .replace(/Pull Request/g, 'Merge Request')
      .replace(/PR/g, 'MR');
  } else if (config.isVsts) {
    // Remove any HTML we use
    prBody = prBody
      .replace('<summary>', '**')
      .replace('</summary>', '**')
      .replace('<details>', '')
      .replace('</details>', '');
  }

  try {
    if (existingPr) {
      if (config.automerge && branchStatus === 'failure') {
        logger.debug(`Setting assignees and reviewers as status checks failed`);
        await addAssigneesReviewers(config, existingPr);
      }
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.info(`${existingPr.displayNumber} does not need updating`);
        return existingPr;
      }
      // PR must need updating
      await platform.updatePr(existingPr.number, prTitle, prBody);
      logger.info({ pr: existingPr.displayNumber }, `Updated PR`);
      return existingPr;
    }
    logger.info({ branchName, prTitle }, `Creating PR`);
    let pr;
    try {
      pr = await platform.createPr(
        branchName,
        prTitle,
        prBody,
        config.labels,
        false,
        config.statusCheckVerify
      );
    } catch (err) {
      logger.warn({ err }, `Failed to create PR`);
      return null;
    }
    // Skip assign and review if automerging PR
    if (
      config.automerge &&
      config.automergeType === 'pr' &&
      branchStatus !== 'failure'
    ) {
      logger.debug(
        `Skipping assignees and reviewers as automerge=${config.automerge}`
      );
    } else {
      await addAssigneesReviewers(config, pr);
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (err) {
    logger.error({ err }, 'Failed to ensure PR:', err);
  }
  return null;
}

async function addAssigneesReviewers(config, pr) {
  if (config.assignees.length > 0) {
    try {
      const assignees = config.assignees.map(
        assignee =>
          assignee.length && assignee[0] === '@' ? assignee.slice(1) : assignee
      );
      await platform.addAssignees(pr.number, assignees);
      logger.info({ assignees: config.assignees }, 'Added assignees');
    } catch (err) {
      logger.info(
        { assignees: config.assignees, err },
        'Failed to add assignees'
      );
    }
  }
  if (config.reviewers.length > 0) {
    try {
      const reviewers = config.reviewers.map(
        reviewer =>
          reviewer.length && reviewer[0] === '@' ? reviewer.slice(1) : reviewer
      );
      await platform.addReviewers(pr.number, reviewers);
      logger.info({ reviewers: config.reviewers }, 'Added reviewers');
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
  logger.debug(`Checking #${pr.number} for automerge`);
  if (config.automerge === true && config.automergeType === 'pr') {
    logger.info('PR is configured for automerge');
    // Return if PR not ready for automerge
    if (pr.mergeable !== true) {
      logger.info('PR is not mergeable');
      logger.debug({ pr });
      return false;
    }
    if (config.requiredStatusChecks && pr.mergeable_state === 'unstable') {
      logger.info('PR mergeable state is unstable');
      return false;
    }
    // Check branch status
    const branchStatus = await platform.getBranchStatus(
      pr.head.ref,
      config.requiredStatusChecks
    );
    logger.debug(`branchStatus=${branchStatus}`);
    if (branchStatus !== 'success') {
      logger.info('Branch status is not "success"');
      return false;
    }
    // Check if it's been touched
    if (!pr.canRebase) {
      logger.info('PR is ready for automerge but has been modified');
      return false;
    }
    // Let's merge this
    logger.info(`Automerging #${pr.number}`);
    return platform.mergePr(pr.number, config.branchName);
  }
  logger.debug('No automerge');
  return false;
}
