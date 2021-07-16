import is from '@sindresorhus/is';
import slugify from 'slugify';
import { mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import { platform } from '../../../platform';
import { BranchStatus } from '../../../types';
import { branchExists } from '../../../util/git';
import { processBranch } from '../../branch';
import { Limit, incLimitedValue, setMaxLimit } from '../../global/limits';
import { BranchConfig, BranchResult } from '../../types';
import { getBranchesRemaining, getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

export async function writeUpdates(
  config: RenovateConfig,
  allBranches: BranchConfig[]
): Promise<WriteUpdateResult> {
  const branches = allBranches;
  logger.debug(
    `Processing ${branches.length} branch${
      branches.length === 1 ? '' : 'es'
    }: ${branches
      .map((b) => b.branchName)
      .sort()
      .join(', ')}`
  );
  const prsRemaining = await getPrsRemaining(config, branches);
  logger.debug({ prsRemaining }, 'Calculated maximum PRs remaining this run');
  setMaxLimit(Limit.PullRequests, prsRemaining);

  const branchesRemaining = await getBranchesRemaining(config, branches);
  logger.debug(
    { branchesRemaining },
    'Calculated maximum branches remaining this run'
  );
  setMaxLimit(Limit.Branches, branchesRemaining);

  const rollups: Record<string, Record<string, BranchConfig[]>> = {};
  for (const branch of branches) {
    addMeta({ branch: branch.branchName });
    const branchExisted = branchExists(branch.branchName);
    const res = await processBranch(branch);
    branch.prBlockedBy = res?.prBlockedBy;
    branch.prNo = res?.prNo;
    branch.result = res?.result;
    const { baseBranch, branchName, rollupName } = branch;
    if (rollupName) {
      if (branchExists(branchName)) {
        const branchStatus = await platform.getBranchStatus(
          branchName,
          branch.requiredStatusChecks
        );
        // TODO: template branch name?
        const rollupBranchName = `${config.branchPrefix}${baseBranch}-${slugify(
          rollupName.toLowerCase()
        )}`;
        rollups[rollupBranchName] ||= {};
        rollups[rollupBranchName][branchStatus] ||= [];
        rollups[rollupBranchName][branchStatus].push(branch);
      }
    }
    if (
      branch.result === BranchResult.Automerged &&
      branch.automergeType !== 'pr-comment'
    ) {
      // Stop processing other branches because base branch has been changed
      return 'automerged';
    }
    if (!branchExisted && branchExists(branch.branchName)) {
      incLimitedValue(Limit.Branches);
    }
  }
  const rollupBranches: BranchConfig[] = [];
  for (const [rollupBranchName, statuses] of Object.entries(rollups)) {
    let branch: BranchConfig;
    if (statuses[BranchStatus.green]?.length) {
      branch = statuses[BranchStatus.green].pop();
      logger.debug(
        `Adding ${branch.upgrades.length} upgrades to rollup branch ${rollupBranchName} from ${branch.branchName}`
      );
      statuses[BranchStatus.green].forEach((greenBranch) => {
        logger.debug(
          `Adding ${greenBranch.upgrades.length} upgrades to rollup branch ${rollupBranchName} from ${greenBranch.branchName}`
        );
        branch.upgrades = branch.upgrades.concat(greenBranch.upgrades);
      });
    } else if (statuses[BranchStatus.yellow]?.length) {
      logger.debug(`Rollup branch ${rollupBranchName} has no passing branches`);
      branch = statuses[BranchStatus.yellow].pop();
      delete branch.upgrades;
      // TODO: PR body
    } else if (statuses[BranchStatus.red]?.length) {
      logger.debug(
        `Rollup branch ${rollupBranchName} has only failing branches`
      );
    }
    if (branch) {
      branch.isRollup = true;
      branch.branchName = rollupBranchName;
      branch.prTitle = branch.rollupName; // TODO: templating?
      branch = mergeChildConfig(branch, branch.rollup);
      delete branch.rollup;
      rollupBranches.push(branch);
    }
  }

  for (const branch of rollupBranches) {
    const res = await processBranch(branch);
    logger.debug({ res });
  }

  // Fix branch list
  removeMeta(['branch']);
  return 'done';
}
