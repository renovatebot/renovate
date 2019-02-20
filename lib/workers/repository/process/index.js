const { mergeChildConfig } = require('../../../config');
const { extractAndUpdate } = require('./extract-update');
const { appName } = require('../../../config/app-strings');

module.exports = {
  processRepo,
};

async function processRepo(config) {
  logger.debug('processRepo()');
  /* eslint-disable no-param-reassign */
  config.masterIssueChecks = {};
  // istanbul ignore if
  if (config.masterIssue || config.masterIssueApproval) {
    config.masterIssueTitle =
      config.masterIssueTitle || `Update Dependencies (${appName} Bot)`;
    const issue = await platform.findIssue(config.masterIssueTitle);
    if (issue) {
      const checkMatch = ' - \\[x\\] <!-- ([a-z]+)-branch=([^\\s]+) -->';
      const checked = issue.body.match(new RegExp(checkMatch, 'g'));
      if (checked && checked.length) {
        checked.forEach(check => {
          const [, type, branchName] = check.match(new RegExp(checkMatch));
          config.masterIssueChecks[branchName] = type;
        });
        /* eslint-enable no-param-reassign */
      }
    }
  }
  if (config.baseBranches && config.baseBranches.length) {
    logger.info({ baseBranches: config.baseBranches }, 'baseBranches');
    let res;
    let branches = [];
    let branchList = [];
    for (const baseBranch of config.baseBranches) {
      logger.debug(`baseBranch: ${baseBranch}`);
      const baseBranchConfig = mergeChildConfig(config, { baseBranch });
      if (config.baseBranches.length > 1) {
        baseBranchConfig.branchPrefix += `${baseBranch}-`;
        baseBranchConfig.hasBaseBranches = true;
      }
      await platform.setBaseBranch(baseBranch);
      const baseBranchRes = await extractAndUpdate(baseBranchConfig);
      ({ res } = baseBranchRes);
      branches = branches.concat(baseBranchRes.branches);
      branchList = branchList.concat(baseBranchRes.branchList);
    }
    return { res, branches, branchList };
  }
  logger.debug('No baseBranches');
  return extractAndUpdate(config);
}
