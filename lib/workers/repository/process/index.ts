import { mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../manager/types';
import { platform } from '../../../platform';
import { branchExists } from '../../../util/git';
import { addSplit } from '../../../util/split';
import type { BranchConfig } from '../../types';
import { ExtractResult, extract, lookup, update } from './extract-update';
import type { WriteUpdateResult } from './write';

function getBaseBranchConfig(
  baseBranch: string,
  config: RenovateConfig
): RenovateConfig {
  logger.debug(`baseBranch: ${baseBranch}`);
  const baseBranchConfig = mergeChildConfig(config, { baseBranch });
  if (config.baseBranches.length > 1) {
    baseBranchConfig.branchPrefix += `${baseBranch}-`;
    baseBranchConfig.hasBaseBranches = true;
  }
  return baseBranchConfig;
}

export async function extractDependencies(
  config: RenovateConfig
): Promise<ExtractResult> {
  logger.debug('processRepo()');
  /* eslint-disable no-param-reassign */
  config.dependencyDashboardChecks = {};
  const stringifiedConfig = JSON.stringify(config);
  // istanbul ignore next
  if (
    config.dependencyDashboard ||
    stringifiedConfig.includes('"dependencyDashboardApproval":true') ||
    stringifiedConfig.includes('"prCreation":"approval"')
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
      if (branchExists(baseBranch)) {
        const baseBranchConfig = getBaseBranchConfig(baseBranch, config);
        extracted[baseBranch] = await extract(baseBranchConfig);
      } else {
        logger.warn({ baseBranch }, 'Base branch does not exist - skipping');
      }
    }
    addSplit('extract');
    for (const baseBranch of config.baseBranches) {
      if (branchExists(baseBranch)) {
        const baseBranchConfig = getBaseBranchConfig(baseBranch, config);
        const packageFiles = extracted[baseBranch];
        const baseBranchRes = await lookup(baseBranchConfig, packageFiles);
        res.branches = res.branches.concat(baseBranchRes?.branches);
        res.branchList = res.branchList.concat(baseBranchRes?.branchList);
        res.packageFiles = res.packageFiles || baseBranchRes?.packageFiles; // Use the first branch
      }
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
  branches: BranchConfig[]
): Promise<WriteUpdateResult | undefined> {
  logger.debug('processRepo()');

  return update(config, branches);
}
