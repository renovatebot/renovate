const { logger, setMeta } = require('../../../logger');
const { mergeChildConfig } = require('../../../config');
const { extractAndUpdate } = require('./extract-update');
const appStrings = require('../../../config/app-strings');
const { platform } = require('../../../platform');

module.exports = {
  processRepo,
};

async function processRepo(config) {
  logger.debug('processRepo()');
  /* eslint-disable no-param-reassign */
  config.masterIssueChecks = {};
  // istanbul ignore next
  if (
    config.masterIssue ||
    config.masterIssueApproval ||
    config.prCreation === 'approval' ||
    (config.packageRules &&
      config.packageRules.some(
        rule => rule.masterIssueApproval || rule.prCreation === 'approval'
      ))
  ) {
    config.masterIssueTitle =
      config.masterIssueTitle ||
      `Update Dependencies (${appStrings.appName} Bot)`;
    const issue = await platform.findIssue(config.masterIssueTitle);
    if (issue) {
      const checkMatch = ' - \\[x\\] <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->';
      const checked = issue.body.match(new RegExp(checkMatch, 'g'));
      if (checked && checked.length) {
        checked.forEach(check => {
          const [, type, branchName] = check.match(new RegExp(checkMatch));
          config.masterIssueChecks[branchName] = type;
        });
      }
      const checkAllMatch = ' - \\[x\\] <!-- rebase-all-open-prs -->';
      const checkedRebaseAll = issue.body.match(new RegExp(checkAllMatch));
      if (checkedRebaseAll) {
        config.masterIssueRebaseAllOpen = true;
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
      setMeta({
        repository: config.repository,
      });
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
