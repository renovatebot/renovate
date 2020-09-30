import { RenovateConfig } from '../../../config';
import { addMeta, logger, removeMeta } from '../../../logger';
import { branchExists } from '../../../util/git';
import { processBranch } from '../../branch';
import { BranchConfig, ProcessBranchResult } from '../../common';
import { Limit, isLimitReached } from '../../global/limits';
import { getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

export async function writeUpdates(
  config: RenovateConfig,
  allBranches: BranchConfig[]
): Promise<WriteUpdateResult> {
  let branches = allBranches;
  logger.debug(
    `Processing ${branches.length} branch${
      branches.length !== 1 ? 'es' : ''
    }: ${branches
      .map((b) => b.branchName)
      .sort()
      .join(', ')}`
  );
  branches = branches.filter((branchConfig) => {
    if (branchConfig.blockedByPin) {
      logger.debug(`Branch ${branchConfig.branchName} is blocked by a Pin PR`);
      return false;
    }
    return true;
  });
  let prsRemaining = await getPrsRemaining(config, branches);
  logger.debug({ prsRemaining }, 'Calculated maximum PRs remaining this run');
  for (const branch of branches) {
    addMeta({ branch: branch.branchName });
    const prLimitReached = prsRemaining <= 0;
    const commitLimitReached = isLimitReached(Limit.Commits);
    const branchExisted = branchExists(branch.branchName);
    const res = await processBranch(branch, prLimitReached, commitLimitReached);
    branch.res = res;
    if (
      res === ProcessBranchResult.Automerged &&
      branch.automergeType !== 'pr-comment'
    ) {
      // Stop procesing other branches because base branch has been changed
      return 'automerged';
    }
    let deductPrRemainingCount = 0;
    if (res === ProcessBranchResult.PrCreated) {
      deductPrRemainingCount = 1;
    }
    // istanbul ignore if
    if (
      res === ProcessBranchResult.Automerged &&
      branch.automergeType === 'pr-comment' &&
      branch.requiredStatusChecks === null
    ) {
      deductPrRemainingCount = 1;
    }
    // istanbul ignore if
    if (
      res === ProcessBranchResult.Pending &&
      !branchExisted &&
      branchExists(branch.branchName)
    ) {
      deductPrRemainingCount = 1;
    }
    prsRemaining -= deductPrRemainingCount;
  }
  removeMeta(['branch']);
  return 'done';
}
