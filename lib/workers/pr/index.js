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
async function ensurePr(upgrades, logger) {
  logger.trace({ config: upgrades }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const config = Object.assign({}, upgrades[0]);
  config.upgrades = [];

  const branchName = handlebars.compile(config.branchName)(config);
  const branchStatus = await config.api.getBranchStatus(branchName);

  // Only create a PR if a branch automerge has failed
  if (config.automergeEnabled && config.automergeType.startsWith('branch')) {
    logger.debug(
      `Branch is configured for branch automerge, branchStatus is: ${branchStatus}`
    );
    if (branchStatus === 'failure') {
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
  } else if (config.prCreation === 'not-pending') {
    logger.debug('Checking branch combined status');
    if (branchStatus === 'pending' || branchStatus === 'running') {
      logger.debug(`Branch status is "${branchStatus}" - not creating PR`);
      return null;
    }
    logger.debug('Branch status success');
  }

  const processedUpgrades = [];

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depName}-${upgrade.changeLogFromVersion}-${upgrade.changeLogToVersion}`;
    if (processedUpgrades.indexOf(upgradeKey) !== -1) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);

    const logJSON = await changelogHelper.getChangeLogJSON(
      upgrade.depName,
      upgrade.changeLogFromVersion,
      upgrade.changeLogToVersion,
      logger
    );
    // Store changelog markdown for backwards compatibility
    if (logJSON) {
      upgrade.githubName = logJSON.project.github;
      upgrade.releases = [];
      logJSON.versions.forEach(version => {
        const release = Object.assign({}, version);
        release.date = version.date.toISOString().slice(0, 10);
        release.commits = [];
        if (release.changes) {
          release.changes.forEach(change => {
            const commit = Object.assign({}, change);
            delete commit.date;
            commit.shortSha = change.sha.slice(0, 7);
            commit.url = `${logJSON.project.repository}/commit/${change.sha}`;
            if (change.message) {
              commit.message = change.message.split('\n')[0];
              const re = /([\s(])#(\d+)([)\s]?)/g;
              commit.message = commit.message.replace(
                re,
                `$1[#$2](${upgrade.repositoryUrl}/issues/$2)$3`
              );
            }
            release.commits.push(commit);
          });
        }
        upgrade.releases.push(release);
      });
    }
    config.upgrades.push(upgrade);
  }

  // Update the config object
  Object.assign(config, upgrades[0]);

  const prTitle = handlebars.compile(config.prTitle)(config);
  const prBodyMarkdown = handlebars.compile(config.prBody)(config);
  const prBody = converter.makeHtml(prBodyMarkdown);

  try {
    // Check if existing PR exists
    const existingPr = await config.api.getBranchPr(branchName);
    if (existingPr) {
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.info(`${existingPr.displayNumber} does not need updating`);
        return existingPr;
      }
      // PR must need updating
      await config.api.updatePr(existingPr.number, prTitle, prBody);
      logger.info(`Updated ${existingPr.displayNumber}`);
      return existingPr;
    }
    logger.debug(`Creating PR for branch ${branchName}`);
    const pr = await config.api.createPr(branchName, prTitle, prBody);
    if (config.labels.length > 0) {
      await config.api.addLabels(pr.number, config.labels);
    }
    // Skip assign and review if automerging PR
    if (config.automergeEnabled && config.automergeType === 'pr') {
      logger.debug(
        `Skipping assignees and reviewers as automerge=${config.automerge}`
      );
    } else {
      if (config.assignees.length > 0) {
        await config.api.addAssignees(pr.number, config.assignees);
      }
      if (config.reviewers.length > 0) {
        await config.api.addReviewers(pr.number, config.reviewers);
      }
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (error) {
    logger.error('Failed to ensure PR:', error);
  }
  return null;
}

async function checkAutoMerge(pr, config, logger) {
  logger.debug(`Checking #${pr.number} for automerge`);
  if (config.automergeEnabled && config.automergeType === 'pr') {
    logger.info('PR is configured for automerge');
    // Return if PR not ready for automerge
    if (pr.mergeable !== true || pr.mergeable_state === 'unstable') {
      logger.info('PR is not ready for merge');
      return;
    }
    // Check branch status
    const branchStatus = await config.api.getBranchStatus(pr.head.ref);
    logger.debug(`branchStatus=${branchStatus}`);
    if (branchStatus !== 'success') {
      logger.info('Branch status is not "success"');
      return;
    }
    // Let's merge this
    logger.info(`Automerging #${pr.number}`);
    await config.api.mergePr(pr);
  } else {
    logger.debug('No automerge');
  }
}
