import { logger } from '../../../logger';
import { processBranch } from '../../branch';
import { getPrsRemaining } from './limits';
import { getLimitRemaining } from '../../global/limits';

export type WriteUpdateResult = 'done' | 'automerged';

export async function writeUpdates(
  config,
  packageFiles,
  allBranches: any[]
): Promise<WriteUpdateResult> {
  let branches = allBranches;
  logger.info(
    `Processing ${branches.length} branch${
      branches.length !== 1 ? 'es' : ''
    }: ${branches
      .map(b => b.branchName)
      .sort()
      .join(', ')}`
  );
  branches = branches.filter(branchConfig => {
    if (branchConfig.blockedByPin) {
      logger.debug(`Branch ${branchConfig.branchName} is blocked by a Pin PR`);
      return false;
    }
    return true;
  });
  let prsRemaining = await getPrsRemaining(config, branches);
  for (const branch of branches) {
    const res = await processBranch(
      branch,
      prsRemaining <= 0 || getLimitRemaining('prCommitsPerRunLimit') <= 0,
      packageFiles
    );
    branch.res = res;
    if (res === 'automerged' && config.automergeType !== 'pr-comment') {
      // Stop procesing other branches because base branch has been changed
      return res;
    }
    prsRemaining -= res === 'pr-created' ? 1 : 0;
  }
  return 'done';
}
