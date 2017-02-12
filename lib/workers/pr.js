const logger = require('winston');
const handlebars = require('../helpers/handlebars');

module.exports = {
  ensurePr,
};

// Ensures that PR exists with matching title/body
async function ensurePr(api, config) {
  logger.debug('Ensuring PR');

  const branchName = handlebars.transform(config.branchName, config);
  const prTitle = handlebars.transform(config.prTitle, config);
  const prBody = handlebars.transform(config.prBody, config);

  try {
    const existingPr = await api.getBranchPr(branchName);
    if (existingPr) {
      await checkExistingPr(existingPr);
    } else {
      const newPr = await createPr(
        config.labels,
        config.assignees,
        config.reviewers);
      logger.info(`Created ${newPr.displayNumber}`);
    }
  } catch (error) {
    logger.error('Failed to ensure PR:', error);
  }

  // Create a new PR
  async function createPr(labels, assignees, reviewers) {
    logger.debug(`Creating PR for branch ${branchName}`);
    const pr = await api.createPr(branchName, prTitle, prBody);
    if (labels.length > 0) {
      await api.addLabels(pr.number, labels);
    }
    if (assignees.length > 0) {
      await api.addAssignees(pr.number, assignees);
    }
    if (reviewers.length > 0) {
      await api.addReviewers(pr.number, reviewers);
    }
    return pr;
  }

  // Check an existing PR and update it if necessary
  async function checkExistingPr(pr) {
    // Check if existing PR needs updating
    if (pr.title === prTitle && pr.body === prBody) {
      logger.verbose(`${pr.displayNumber} already up-to-date`);
      return;
    }
    // PR must need updating
    logger.debug(`updatePr: ${pr.displayNumber}`);
    await api.updatePr(pr.number, prTitle, prBody);
    logger.info(`Updated ${pr.displayNumber}`);
  }
}
