import { RenovateConfig } from '../../../config';
import { addMeta, logger, removeMeta } from '../../../logger';
import { platform } from '../../../platform';
import { PrState } from '../../../types';
import { branchExists } from '../../../util/git';
import { processBranch } from '../../branch';
import { BranchConfig, ProcessBranchResult } from '../../common';
import { Limit, incLimitedValue, setMaxLimit } from '../../global/limits';
import { getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

async function prExists(branchName: string): Promise<boolean> {
  try {
    const pr = await platform.getBranchPr(branchName);
    return pr?.state === PrState.Open;
  } catch (err) /* istanbul ignore next */ {
    return false;
  }
}

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
  const prsRemaining = await getPrsRemaining(config, branches);
  logger.debug({ prsRemaining }, 'Calculated maximum PRs remaining this run');
  setMaxLimit(Limit.PullRequests, prsRemaining);
  for (const branch of branches) {
    addMeta({ branch: branch.branchName });
    const branchExisted = branchExists(branch.branchName);
    const prExisted = await prExists(branch.branchName);
    const res = await processBranch(branch);
    branch.res = res;
    if (
      res === ProcessBranchResult.Automerged &&
      branch.automergeType !== 'pr-comment'
    ) {
      // Stop processing other branches because base branch has been changed
      return 'automerged';
    }
    if (res === ProcessBranchResult.PrCreated) {
      incLimitedValue(Limit.PullRequests);
    }
    // istanbul ignore if
    else if (
      res === ProcessBranchResult.Automerged &&
      branch.automergeType === 'pr-comment' &&
      branch.requiredStatusChecks === null
    ) {
      incLimitedValue(Limit.PullRequests);
    } else if (
      res === ProcessBranchResult.Pending &&
      !branchExisted &&
      branchExists(branch.branchName)
    ) {
      incLimitedValue(Limit.PullRequests);
    }
    // istanbul ignore if
    else if (!prExisted && (await prExists(branch.branchName))) {
      incLimitedValue(Limit.PullRequests);
    }
  }
  removeMeta(['branch']);
  return 'done';
}
