import type { RenovateConfig } from '../../../config/types.ts';
import { addBranchStats } from '../../../instrumentation/reporting.ts';
import { logger } from '../../../logger/index.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import {
  getCache,
  isCacheModified,
} from '../../../util/cache/repository/index.ts';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../../util/cache/repository/types.ts';
import { getInheritedOrGlobal } from '../../../util/common.ts';
import type {
  BaseBranchMetadata,
  BaseBranchUpdateSummary,
  BranchMetadata,
  BranchSummary,
  ManagerUpdateSummary,
  UpdateSummary,
} from '../../types.ts';

export function runRenovateRepoStats(
  config: RenovateConfig,
  prList: Pr[],
): void {
  const prStats = { total: 0, open: 0, closed: 0, merged: 0 };

  for (const pr of prList) {
    if (
      pr.title === 'Configure Renovate' ||
      pr.title === getInheritedOrGlobal('onboardingPrTitle')
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

    const updateSummary = getUpdateSummary(branches);
    logger.debug({ updateSummary }, 'Updates summary');
  }
}

export function getUpdateSummary(branches: BranchCache[]): UpdateSummary {
  const summaryByBase = new Map<string, BaseBranchUpdateSummary>();

  for (const branch of branches) {
    const baseBranch = branch.baseBranch ?? '';
    let entry = summaryByBase.get(baseBranch);
    if (!entry) {
      entry = {
        baseBranch,
        total: 0,
        vulnerabilityAlert: 0,
        updates: {},
        managers: {},
      };
      summaryByBase.set(baseBranch, entry);
    }
    for (const upgrade of branch.upgrades ?? []) {
      const { updateType } = upgrade;
      if (updateType) {
        entry.total += 1;
        if (upgrade.isVulnerabilityAlert) {
          entry.vulnerabilityAlert += 1;
        }

        entry.updates[updateType] = (entry.updates[updateType] ?? 0) + 1;

        const manager = upgrade.manager ?? '';
        let managerEntry: ManagerUpdateSummary | undefined =
          entry.managers[manager];
        if (!managerEntry) {
          managerEntry = { total: 0, vulnerabilityAlert: 0, updates: {} };
          entry.managers[manager] = managerEntry;
        }
        managerEntry.total += 1;
        if (upgrade.isVulnerabilityAlert) {
          managerEntry.vulnerabilityAlert += 1;
        }
        managerEntry.updates[updateType] =
          (managerEntry.updates[updateType] ?? 0) + 1;
      } else {
        logger.debug(
          { upgrade },
          'Found an upgrade without an updateType, which should not be possible',
        );
      }
    }
  }

  return Array.from(summaryByBase.values());
}
