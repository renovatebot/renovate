import type { RenovateConfig } from '../../../config/types';
import { addBranchStats } from '../../../instrumentation/reporting';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { getCache, isCacheModified } from '../../../util/cache/repository';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../../util/cache/repository/types';
import type {
  BaseBranchMetadata,
  BranchMetadata,
  BranchSummary,
} from '../../types';

export function runRenovateRepoStats(
  config: RenovateConfig,
  prList: Pr[],
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

function filterDependencyDashboardData(
  branches: BranchCache[],
): Partial<BranchCache>[] {
  const branchesFiltered: Partial<BranchCache>[] = [];
  for (const branch of branches) {
    const upgradesFiltered: Partial<BranchUpgradeCache>[] = [];
    const { branchName, prNo, prTitle, result, upgrades, prBlockedBy } = branch;

    for (const upgrade of upgrades ?? []) {
      const {
        datasource,
        depName,
        displayPending,
        fixedVersion,
        currentVersion,
        currentValue,
        currentDigest,
        newValue,
        newVersion,
        newDigest,
        packageFile,
        updateType,
        packageName,
      } = upgrade;

      const filteredUpgrade: Partial<BranchUpgradeCache> = {
        datasource,
        depName,
        displayPending,
        fixedVersion,
        currentVersion,
        currentValue,
        currentDigest,
        newValue,
        newVersion,
        newDigest,
        packageFile,
        updateType,
        packageName,
      };
      upgradesFiltered.push(filteredUpgrade);
    }

    const filteredBranch: Partial<BranchCache> = {
      branchName,
      prNo,
      prTitle,
      result,
      prBlockedBy,
      upgrades: upgradesFiltered,
    };
    branchesFiltered.push(filteredBranch);
  }

  return branchesFiltered;
}

export function runBranchSummary(config: RenovateConfig): void {
  const defaultBranch = config.defaultBranch;
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

  if (branches?.length) {
    const branchesInformation = filterDependencyDashboardData(branches);
    addBranchStats(config, branchesInformation);
    logger.debug({ branchesInformation }, 'branches info extended');
  }
}
