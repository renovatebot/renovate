import { RenovateConfig, mergeChildConfig } from '../../../config';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';
import { platform } from '../../../platform';
import { addSplit } from '../../../util/split';
import { BranchConfig } from '../../common';
import { ExtractResult, extract, lookup, update } from './extract-update';
import { WriteUpdateResult } from './write';

async function setBaseBranch(
  baseBranch: string,
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug(`baseBranch: ${baseBranch}`);
  const baseBranchConfig = mergeChildConfig(config, { baseBranch });
  if (config.baseBranches.length > 1) {
    baseBranchConfig.branchPrefix += `${baseBranch}-`;
    baseBranchConfig.hasBaseBranches = true;
  }
  baseBranchConfig.baseBranchSha = await platform.setBaseBranch(baseBranch);
  return baseBranchConfig;
}

export async function extractDependencies(
  config: RenovateConfig
): Promise<ExtractResult> {
  logger.debug('processRepo()');
  /* eslint-disable no-param-reassign */
  config.dependencyDashboardChecks = {};
  // istanbul ignore next
  if (
    config.dependencyDashboard ||
    config.dependencyDashboardApproval ||
    config.prCreation === 'approval' ||
    (config.packageRules &&
      config.packageRules.some(
        (rule) =>
          rule.dependencyDashboardApproval || rule.prCreation === 'approval'
      ))
  ) {
    config.dependencyDashboardTitle =
      config.dependencyDashboardTitle || `Dependency Dashboard`;
    const issue = await platform.findIssue(config.dependencyDashboardTitle);
    if (issue) {
      const checkMatch = ' - \\[x\\] <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->';
      const checked = issue.body.match(new RegExp(checkMatch, 'g'));
      if (checked?.length) {
        const re = new RegExp(checkMatch);
        checked.forEach((check) => {
          const [, type, branchName] = re.exec(check);
          config.dependencyDashboardChecks[branchName] = type;
        });
      }
      const checkedRebaseAll = issue.body.includes(
        ' - [x] <!-- rebase-all-open-prs -->'
      );
      if (checkedRebaseAll) {
        config.dependencyDashboardRebaseAllOpen = true;
        /* eslint-enable no-param-reassign */
      }
    }
  }
  let res: ExtractResult = {
    branches: [],
    branchList: [],
    packageFiles: null,
  };
  if (config.baseBranches?.length) {
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
    const extracted: Record<string, Record<string, PackageFile[]>> = {};
    for (const baseBranch of config.baseBranches) {
      const baseBranchConfig = await setBaseBranch(baseBranch, config);
      extracted[baseBranch] = await extract(baseBranchConfig);
    }
    addSplit('extract');
    for (const baseBranch of config.baseBranches) {
      const baseBranchConfig = await setBaseBranch(baseBranch, config);
      const packageFiles = extracted[baseBranch];
      const baseBranchRes = await lookup(baseBranchConfig, packageFiles);
      res.branches = res.branches.concat(baseBranchRes?.branches);
      res.branchList = res.branchList.concat(baseBranchRes?.branchList);
      res.packageFiles = res.packageFiles || baseBranchRes?.packageFiles; // Use the first branch
    }
  } else {
    logger.debug('No baseBranches');
    const packageFiles = await extract(config);
    addSplit('extract');
    res = await lookup(config, packageFiles);
  }
  addSplit('lookup');
  return res;
}

export function updateRepo(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[]
): Promise<WriteUpdateResult | undefined> {
  logger.debug('processRepo()');

  return update(config, branches);
}
