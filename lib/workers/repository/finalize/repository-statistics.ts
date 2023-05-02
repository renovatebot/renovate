import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { getCache, isCacheModified } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import type {
  BaseBranchMetadata,
  BranchMetadata,
  BranchSummary,
} from '../../types';

export function runRenovateRepoStats(
  config: RenovateConfig,
  prList: Pr[]
): void {
  const prStats = { total: 0, open: 0, closed: 0, merged: 0 };

  for (const pr of prList) {
    if (
      pr.title === 'Configure Renovate' ||
      pr.title === config.onboardingPrTitle
    ) {
      continue;
    }
    prStats.total += 1;
    switch (pr.state) {
      case 'merged':
        prStats.merged += 1;
        break;
      case 'closed':
        prStats.closed += 1;
        break;
      case 'open':
        prStats.open += 1;
        break;
      default:
        break;
    }
  }
  logger.debug({ stats: prStats }, `Renovate repository PR statistics`);
}

function branchCacheToMetadata({
  automerge,
  baseBranch,
  baseBranchSha,
  branchName,
  isModified,
  pristine: isPristine,
  sha: branchSha,
}: BranchCache): BranchMetadata {
  return {
    automerge,
    baseBranch,
    baseBranchSha,
    branchName,
    branchSha,
    isModified,
    isPristine,
  };
}

export function runBranchSummary({ defaultBranch }: RenovateConfig): void {
  const { scan, branches } = getCache();

  const baseMetadata: BaseBranchMetadata[] = [];
  for (const [branchName, cached] of Object.entries(scan ?? {})) {
    baseMetadata.push({ branchName, sha: cached.sha });
  }

  const branchMetadata: BranchMetadata[] = [];
  const inactiveBranches: string[] = [];

  for (const branch of branches ?? []) {
    if (branch.sha) {
      branchMetadata.push(branchCacheToMetadata(branch));
    } else {
      inactiveBranches.push(branch.branchName);
    }
  }

  const res: BranchSummary = {
    cacheModified: isCacheModified(),
    baseBranches: baseMetadata,
    branches: branchMetadata,
    defaultBranch,
    inactiveBranches,
  };

  logger.debug(res, 'Branch summary');
}
