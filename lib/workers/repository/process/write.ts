import { logger, addMeta, removeMeta } from '../../../logger';
import { processBranch } from '../../branch';
import { getPrsRemaining } from './limits';
import { getLimitRemaining } from '../../global/limits';
import { RenovateConfig } from '../../../config';
import { PackageFile } from '../../../manager/common';
import { AdditionalPackageFiles } from '../../../manager/npm/post-update';
import { BranchConfig } from '../../common';

export type WriteUpdateResult = 'done' | 'automerged';

export async function writeUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | AdditionalPackageFiles,
  allBranches: BranchConfig[]
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
    addMeta({ branch: branch.branchName });
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
  removeMeta(['branch']);
  return 'done';
}
