import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { PrState } from '../../../types';
import { getCache, isCacheModified } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';

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
      case PrState.Merged:
        prStats.merged += 1;
        break;
      case PrState.Closed:
        prStats.closed += 1;
        break;
      case PrState.Open:
        prStats.open += 1;
        break;
      default:
        break;
    }
  }
  logger.debug({ stats: prStats }, `Renovate repository PR statistics`);
}

export interface BranchMetadata {
  branchName: string;
  branchSha: string | null;
  baseBranch: string | undefined;
  baseBranchSha: string | null;
  automerge: boolean;
  isModified: boolean;
}

export interface BaseBranchMetadata {
  branchName: string;
  sha: string;
}

export interface BranchSummary {
  cacheModified: boolean | undefined;
  baseBranches: BaseBranchMetadata[];
  branches: BranchMetadata[];
  inactiveBranches: string[];
}

export function branchCacheToMetadata({
  branchName,
  sha: branchSha,
  baseBranch,
  parentSha: baseBranchSha,
  automerge,
  isModified,
}: BranchCache): BranchMetadata {
  return {
    branchName,
    branchSha,
    baseBranch,
    baseBranchSha,
    automerge,
    isModified,
  };
}

export async function runBranchSummary(): Promise<void> {
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
    cacheModified: await isCacheModified(),
    baseBranches: baseMetadata,
    branches: branchMetadata,
    inactiveBranches,
  };

  logger.debug(res, 'Branch summary');
}
