import { RenovateConfig } from '../../../config';
import { addMeta, logger, removeMeta } from '../../../logger';
import { processBranch } from '../../branch';
import { BranchConfig } from '../../common';
import { incrementLimit, setLimit } from '../../global/limits';
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
  const prsRemaining = await getPrsRemaining(config, branches);
  logger.debug({ prsRemaining }, 'Calculated maximum PRs remaining this run');
  setLimit('prsRemaining', prsRemaining);
  for (const branch of branches) {
    addMeta({ branch: branch.branchName });
    const res = await processBranch(branch);
    branch.res = res;
    if (res === 'automerged' && branch.automergeType !== 'pr-comment') {
      // Stop procesing other branches because base branch has been changed
      return res;
    }
    if (res === 'pr-created') {
      incrementLimit('prsRemaining');
    }
    // istanbul ignore if
    if (
      res === 'automerged' &&
      branch.automergeType === 'pr-comment' &&
      branch.requiredStatusChecks === null
    ) {
      incrementLimit('prsRemaining');
    }
  }
  removeMeta(['branch']);
  return 'done';
}
