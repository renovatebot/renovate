import { RenovateConfig } from '../../../config';
import { addMeta, logger, removeMeta } from '../../../logger';
import { processBranch } from '../../branch';
import { BranchConfig, ProcessBranchResult } from '../../common';
import { getLimitRemaining } from '../../global/limits';
import { getPrsRemaining } from './limits';
import * as limits from '../../global/limits';

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

    let res: ProcessBranchResult;
    const commitsRemaining = getLimitRemaining('prCommitsPerRunLimit');
    const commitLimitsEnabled = typeof commitsRemaining !== 'undefined';
    const limitsReached = commitLimitsEnabled
      ? prsRemaining <= 0 || commitsRemaining <= 0
      : prsRemaining <= 0;
    if (commitLimitsEnabled && commitsRemaining <= 1) {
      await processBranch(
        { ...branch, dryRun: true, speculativeRun: true },
        limitsReached
      );
      const commitsWillRemain = getLimitRemaining('prCommitsPerRunLimit');
      const numCommits = commitsRemaining - commitsWillRemain;
      limits.incrementLimit('prCommitsPerRunLimit', -numCommits);

      if (commitsWillRemain < 0) {
        logger.info('Reached PR per run commits limit - skipping branch');
        res = 'pr-hourly-limit-reached';
      } else {
        res = await processBranch(branch, limitsReached);
      }
    } else {
      res = await processBranch(branch, limitsReached);
    }

    branch.res = res;
    if (res === 'automerged' && branch.automergeType !== 'pr-comment') {
      // Stop procesing other branches because base branch has been changed
      return res;
    }
    let deductPrRemainingCount = 0;
    if (res === 'pr-created') {
      deductPrRemainingCount = 1;
    }
    // istanbul ignore if
    if (
      res === 'automerged' &&
      branch.automergeType === 'pr-comment' &&
      branch.requiredStatusChecks === null
    ) {
      deductPrRemainingCount = 1;
    }
    prsRemaining -= deductPrRemainingCount;
  }
  removeMeta(['branch']);
  return 'done';
}
