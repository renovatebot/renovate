const logger = require('winston');
const handlebars = require('handlebars');
const getChangeLog = require('../helpers/changelog');

module.exports = {
  ensurePr,
  checkAutoMerge,
};

// Ensures that PR exists with matching title/body
async function ensurePr(upgradeConfig) {
  const config = Object.assign({}, upgradeConfig);
  logger.debug('Ensuring PR');

  const branchName = handlebars.compile(config.branchName)(config);

  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    const branchStatus = await config.api.getBranchStatus(branchName);
    if (branchStatus !== 'success') {
      logger.debug(`Branch status is "${branchStatus}" - not creating PR`);
      return null;
    }
    logger.debug('Branch status success');
  } else if (config.prCreation === 'not-pending') {
    logger.debug('Checking branch combined status');
    const branchStatus = await config.api.getBranchStatus(branchName);
    if (branchStatus === 'pending' || branchStatus === 'running') {
      logger.debug(`Branch status is "${branchStatus}" - not creating PR`);
      return null;
    }
    logger.debug('Branch status success');
  }

  // Get changelog and then generate template strings
  config.changelog =
    await getChangeLog(config.depName, config.changeLogFromVersion, config.changeLogToVersion);
  const prTitle = handlebars.compile(config.prTitle)(config);
  const prBody = handlebars.compile(config.prBody)(config);

  try {
    // Check if existing PR exists
    const existingPr = await config.api.getBranchPr(branchName);
    if (existingPr) {
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.verbose(`${existingPr.displayNumber} already up-to-date`);
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
    // Don't assign or review if automerging
    if (config.automerge === 'none' ||
      (config.automerge === 'minor' && config.upgradeType !== 'minor')) {
      if (config.assignees.length > 0) {
        await config.api.addAssignees(pr.number, config.assignees);
      }
      if (config.reviewers.length > 0) {
        await config.api.addReviewers(pr.number, config.reviewers);
      }
    } else {
      logger.debug(`Skipping assignees and reviewers as automerge=${config.automerge}`);
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (error) {
    logger.error('Failed to ensure PR:', error);
  }
  return null;
}

async function checkAutoMerge(pr, config) {
  logger.debug(`Checking #${pr.number} for automerge`);
  if (config.automerge === 'any' ||
    (config.automerge === 'minor' && config.upgradeType === 'minor')) {
    logger.verbose('PR is configured for automerge');
    logger.debug(JSON.stringify(pr));
    // Return if PR not ready for automerge
    if (pr.mergeable !== true || pr.mergeable_state === 'unstable') {
      logger.verbose('PR is not ready for merge');
      return;
    }
    // Check branch status
    const branchStatus = await config.api.getBranchStatus(pr.head.ref);
    logger.debug(`branchStatus=${branchStatus}`);
    if (branchStatus !== 'success') {
      logger.verbose('Branch status is not "success"');
      return;
    }
    // Let's merge this
    logger.info(`Automerging #${pr.number}`);
    await config.api.mergePr(pr);
  } else {
    logger.verbose('No automerge');
  }
}
