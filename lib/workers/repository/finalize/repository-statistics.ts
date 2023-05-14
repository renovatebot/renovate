import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import type { Pr } from '../../../modules/platform';
import { getCache, isCacheModified } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import type {
  BaseBranchMetadata,
  BranchMetadata,
  BranchSummary,
} from '../../types';
import { extractRepoProblems } from '../dependency-dashboard';

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

function filterDependencyDashboardData(
  branches: BranchCache[]
): Partial<BranchCache>[] {
  let dependencyDashboardData = [...branches];
  dependencyDashboardData = dependencyDashboardData.map((branch) => {
    const b = { ...branch };
    delete b.isModified;
    delete b.automerge;
    delete b.isBehindBase;
    delete b.isConflicted;
    delete b.baseBranch;
    delete b.baseBranchSha;
    delete b.branchFingerprint;
    delete b.pristine;
    delete b.prCache;
    delete b.sha;
    delete b.dependencyDashboard,
      delete b.dependencyDashboardApproval,
      delete b.dependencyDashboardFooter,
      delete b.dependencyDashboardHeader,
      delete b.dependencyDashboardPrApproval,
      delete b.dependencyDashboardTitle,
      (b.upgrades = b.upgrades?.map((upgrade) => {
        const u = { ...upgrade };
        delete u.sourceUrl;
        delete u.depType;
        return u;
      }));
    return b;
  });
  return dependencyDashboardData;
}

function minimizePackageFiles(
  packageFiles: Record<string, PackageFile[]>
): Record<string, Partial<PackageFile>[]> {
  const packageFilesMinimized: Record<string, Partial<PackageFile>[]> = {};
  if (packageFiles) {
    for (const manager in packageFiles) {
      const packageFile = packageFiles[manager];
      packageFilesMinimized[manager] = packageFile.map((file) => ({
        deps: file.deps.map(({ warnings }) => ({ warnings })),
        packageFile: file.packageFile,
      }));
    }
  }
  return packageFilesMinimized;
}

export function runBranchSummary(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>
): void {
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

  if (config.logDependencyDashboardInfo && branches?.length) {
    const branchesInformation = filterDependencyDashboardData(branches);

    // log repo problems for dependency dashboard
    const repoProblems = extractRepoProblems(config);

    // log minimized packageFiles necessary for dependency dashboard
    const packageFilesToPrint = minimizePackageFiles(packageFiles);

    logger.debug(
      { branchesInformation, repoProblems, packageFilesToPrint },
      'branches info extended'
    );
  }
}
