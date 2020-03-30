import { logger } from '../../../logger';
import { mergeChildConfig, RenovateConfig } from '../../../config';
import { extract, ExtractResult, update, UpdateResult } from './extract-update';
import { platform } from '../../../platform';
import { WriteUpdateResult } from './write';
import { BranchConfig } from '../../common';
import { PackageFile } from '../../../manager/common';

export async function processRepo(
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
  if (config.baseBranches && config.baseBranches.length) {
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
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
      const baseBranchRes = await extract(baseBranchConfig);
      branches = branches.concat(baseBranchRes.branches);
      branchList = branchList.concat(baseBranchRes.branchList);
    }
    return { branches, branchList };
  }
  logger.debug('No baseBranches');
  return extract(config);
}

export async function updateRepo(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[],
  packageFiles?: Record<string, PackageFile[]>
): Promise<UpdateResult> {
  logger.debug('processRepo()');

  return update(config, branches, branchList, packageFiles);
}
