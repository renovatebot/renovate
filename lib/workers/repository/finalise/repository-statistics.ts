import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { PrState } from '../../../types';
import { getCache } from '../../../util/cache/repository';
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

interface BranchMetadata {
  branchName: string;
  sha: string | null;
  parentSha: string | null;
  automerge: boolean;
  isModified: boolean;
}

interface BaseBranchMetadata {
  branchName: string;
  sha: string;
}

function unwrap({
  branchName,
  sha,
  parentSha,
  automerge,
  isModified,
}: BranchCache): BranchMetadata {
  return { branchName, sha, parentSha, automerge, isModified };
}

export function runBranchSummery(): void {
  const { scan, branches } = getCache();

  const baseMetadata: BaseBranchMetadata[] = [];
  for (const [branchName, cached] of Object.entries(scan ?? {})) {
    baseMetadata.push({ branchName, sha: cached.sha });
  }

  const branchMetadata: BranchMetadata[] = [];
  const inactiveBranches: string[] = [];

  for (const branch of branches ?? []) {
    if (branch.sha) {
      branchMetadata.push(unwrap(branch));
    } else {
      inactiveBranches.push(branch.branchName);
    }
  }

  logger.debug(
    {
      baseBranches: baseMetadata,
      branches: branchMetadata,
      inactiveBranches,
    },
    'Branch summary'
  );
}
