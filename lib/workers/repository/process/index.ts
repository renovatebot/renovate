import { logger } from '../../../logger';
import { mergeChildConfig, RenovateConfig } from '../../../config';
import { extractAndUpdate, ExtractAndUpdateResult } from './extract-update';
import { platform } from '../../../platform';
import { WriteUpdateResult } from './write';
import { BranchConfig } from '../../common';

export async function processRepo(
  config: RenovateConfig
): Promise<ExtractAndUpdateResult> {
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
      config.masterIssueTitle || `Update Dependencies (Renovate Bot)`;
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
    let res: WriteUpdateResult | undefined;
    let branches: BranchConfig[] = [];
    let branchList: string[] = [];
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
