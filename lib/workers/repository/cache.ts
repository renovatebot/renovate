/* istanbul ignore file */

import { nameFromLevel } from 'bunyan';
import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import { getProblems, logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { platform } from '../../modules/platform';
import { scm } from '../../modules/platform/scm';
import { getCache } from '../../util/cache/repository';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../util/cache/repository/types';
import { getCachedBehindBaseResult } from '../../util/git/behind-base-branch-cache';
import { getCachedConflictResult } from '../../util/git/conflicts-cache';
import { getCachedModifiedResult } from '../../util/git/modified-cache';
import { getCachedPristineResult } from '../../util/git/pristine';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import { getPrCache } from './update/pr/pr-cache';

function generateBranchUpgradeCache(
  upgrade: BranchUpgradeConfig
): BranchUpgradeCache {
  const {
    datasource,
    depName,
    depNameLinked,
    depType,
    displayPending,
    packageName,
    fixedVersion,
    currentVersion,
    newVersion,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    packageFile,
    sourceUrl,
    remediationNotPossible,
    updateType,
  } = upgrade;
  const result: BranchUpgradeCache = {
    datasource,
    depName,
    depNameLinked,
    depType,
    displayPending,
    fixedVersion,
    currentVersion,
    currentValue,
    newValue,
    newVersion,
    currentDigest,
    newDigest,
    packageFile,
    sourceUrl,
    remediationNotPossible,
    updateType,
  };
  if (packageName) {
    result.packageName = packageName;
  }
  return result;
}

async function generateBranchCache(
  branch: BranchConfig
): Promise<BranchCache | null> {
  const {
    baseBranch,
    branchName,
    dependencyDashboard,
    dependencyDashboardApproval,
    dependencyDashboardFooter,
    dependencyDashboardHeader,
    dependencyDashboardPrApproval,
    dependencyDashboardTitle,
    packageFiles,
    prBlockedBy,
    prTitle,
    repository,
    result,
  } = branch;
  try {
    const branchSha = await scm.getBranchCommit(branchName);
    const baseBranchSha = await scm.getBranchCommit(baseBranch);
    const pristine = getCachedPristineResult(branchName);
    let prNo = null;
    let isModified: boolean | undefined;
    let isBehindBase: boolean | undefined;
    let isConflicted: boolean | undefined;
    if (baseBranchSha && branchSha) {
      const branchPr = await platform.getBranchPr(branchName);
      if (branchPr) {
        prNo = branchPr.number;
      }
      isModified = getCachedModifiedResult(branchName, branchSha) ?? undefined;
      isBehindBase =
        getCachedBehindBaseResult(
          branchName,
          branchSha,
          baseBranch,
          baseBranchSha
        ) ?? undefined;
      isConflicted =
        getCachedConflictResult(
          branchName,
          branchSha,
          baseBranch,
          baseBranchSha
        ) ?? undefined;
    }

    const automerge = !!branch.automerge;
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    const branchFingerprint = branch.branchFingerprint;
    const prCache = getPrCache(branchName);

    // we minimize to packageFile+warnings because that's what getDepWarningsDashboard needs.
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

    //get repo problems to log into branch summary
    const repoProblems = new Set(
      getProblems()
        .filter(
          (problem) =>
            problem.repository === repository && !problem.artifactErrors
        )
        .map(
          (problem) =>
            `${nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`
        )
    );

    return {
      automerge,
      baseBranchSha,
      baseBranch,
      branchFingerprint,
      branchName,
      dependencyDashboard,
      dependencyDashboardApproval,
      dependencyDashboardFooter,
      dependencyDashboardHeader,
      dependencyDashboardPrApproval,
      dependencyDashboardTitle,
      isBehindBase,
      isConflicted,
      isModified,
      prBlockedBy,
      pristine,
      prCache,
      prNo,
      prTitle,
      repoProblems,
      result,
      sha: branchSha,
      upgrades,
      packageFiles: packageFilesMinimized,
    };
  } catch (error) {
    const err = error.err || error; // external host error nests err
    const errCodes = [401, 404];
    // istanbul ignore if
    if (errCodes.includes(err.response?.statusCode)) {
      logger.warn({ err, branchName }, 'HTTP error generating branch cache');
      return null;
    }
    if (err.message === REPOSITORY_CHANGED) {
      throw err;
    }
    logger.error({ err, branchName }, 'Error generating branch cache');
    return null;
  }
}

export async function setBranchCache(branches: BranchConfig[]): Promise<void> {
  const branchCaches: BranchCache[] = [];
  for (const branch of branches) {
    const branchCache = await generateBranchCache(branch);
    if (branchCache) {
      branchCaches.push(branchCache);
    }
  }
  getCache().branches = branchCaches;
}
