const logger = require('winston');
const changelog = require('changelog');
const handlebars = require('handlebars');

module.exports = {
  ensurePr,
};

// Get Changelog
async function getChangeLog(depName, fromVersion, newVersion) {
  if (!fromVersion || fromVersion === newVersion) {
    return '';
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  let markdownLog;
  try {
    const log = await changelog.generate(depName, semverString);
    markdownLog = changelog.markdown(log);
  } catch (error) {
    logger.verbose(`getChangeLog error: ${error}`);
  }
  // Add a header if log exists
  if (!markdownLog) {
    logger.verbose(`No changelog for ${depName}`);
    markdownLog = '';
  } else {
    markdownLog = `### Changelog\n\n${markdownLog}`;
    markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  }
  return markdownLog;
}

// Ensures that PR exists with matching title/body
async function ensurePr(api, inputConfig) {
  const config = Object.assign({}, inputConfig);
  logger.debug('Ensuring PR');
  config.changelog = await getChangeLog(config.depName, config.workingVersion, config.newVersion);

  const branchName = handlebars.compile(config.branchName)(config);
  const prTitle = handlebars.compile(config.prTitle)(config);
  const prBody = handlebars.compile(config.prBody)(config);

  try {
    const existingPr = await api.getBranchPr(branchName);
    if (existingPr) {
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.verbose(`${existingPr.displayNumber} already up-to-date`);
        return existingPr;
      }
      // PR must need updating
      logger.debug(`updatePr: ${existingPr.displayNumber}`);
      await api.updatePr(existingPr.number, prTitle, prBody);
      logger.info(`Updated ${existingPr.displayNumber}`);
      return existingPr;
    }
    logger.debug(`Creating PR for branch ${branchName}`);
    const pr = await api.createPr(branchName, prTitle, prBody);
    if (config.labels.length > 0) {
      await api.addLabels(pr.number, config.labels);
    }
    if (config.assignees.length > 0) {
      await api.addAssignees(pr.number, config.assignees);
    }
    if (config.reviewers.length > 0) {
      await api.addReviewers(pr.number, config.reviewers);
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (error) {
    logger.error('Failed to ensure PR:', error);
    return null;
  }
}
