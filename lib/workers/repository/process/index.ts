import { RenovateConfig, mergeChildConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { BranchConfig } from '../../common';
import { ExtractResult, extract, update } from './extract-update';
import { WriteUpdateResult } from './write';

export async function extractDependencies(
  config: RenovateConfig
): Promise<ExtractResult> {
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
        const re = new RegExp(checkMatch);
        checked.forEach(check => {
          const [, type, branchName] = re.exec(check);
          config.masterIssueChecks[branchName] = type;
        });
      }
      const checkedRebaseAll = issue.body.includes(
        ' - [x] <!-- rebase-all-open-prs -->'
      );
      if (checkedRebaseAll) {
        config.masterIssueRebaseAllOpen = true;
        /* eslint-enable no-param-reassign */
      }
    }
  }
  let res: ExtractResult = {
    branches: [],
    branchList: [],
    packageFiles: null,
  };
  if (config.baseBranches && config.baseBranches.length) {
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
    for (const baseBranch of config.baseBranches) {
      logger.debug(`baseBranch: ${baseBranch}`);
      const baseBranchConfig = mergeChildConfig(config, { baseBranch });
      if (config.baseBranches.length > 1) {
        baseBranchConfig.branchPrefix += `${baseBranch}-`;
        baseBranchConfig.hasBaseBranches = true;
      }
      baseBranchConfig.baseBranchSha = await platform.setBaseBranch(baseBranch);
      const baseBranchRes = await extract(baseBranchConfig);
      res.branches = res.branches.concat(baseBranchRes.branches);
      res.branchList = res.branchList.concat(baseBranchRes.branchList);
      res.packageFiles = res.packageFiles || baseBranchRes.packageFiles; // Use the first branch
    }
  } else {
    logger.debug('No baseBranches');
    res = await extract(config);
  }
  return res;
}

export async function updateRepo(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[]
): Promise<WriteUpdateResult | undefined> {
  logger.debug('processRepo()');

  return update(config, branches);
}
