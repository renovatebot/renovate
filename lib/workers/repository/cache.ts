/* istanbul ignore file */

import { logger } from '../../logger';
import { platform } from '../../modules/platform';
import { getCache } from '../../util/cache/repository';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../util/cache/repository/types';
import {
  getBranchCommit,
  isBranchConflicted,
  isBranchModified,
} from '../../util/git';
import { getCachedBranchParentShaResult } from '../../util/git/parent-sha-cache';
import type { BranchConfig, BranchUpgradeConfig } from '../types';

function generateBranchUpgradeCache(
  upgrade: BranchUpgradeConfig
): BranchUpgradeCache {
  const {
    datasource,
    depName,
    packageName,
    fixedVersion,
    currentVersion,
    newVersion,
    currentDigest,
    newDigest,
    sourceUrl,
  } = upgrade;
  const result: BranchUpgradeCache = {
    datasource,
    depName,
    fixedVersion,
    currentVersion,
    newVersion,
    currentDigest,
    newDigest,
    sourceUrl,
  };
  if (packageName) {
    result.packageName = packageName;
  }
  return result;
}

async function generateBranchCache(
  branch: BranchConfig
): Promise<BranchCache | null> {
  const { branchName } = branch;
  const baseBranchName = branch.baseBranch ?? branch.defaultBranch;
  try {
    const sha = getBranchCommit(branchName) ?? null;
    let prNo = null;
    let baseBranchSha = null;
    const parentSha = getCachedBranchParentShaResult(branchName, sha);
    if (sha) {
      // TODO: (fix types) #7154
      baseBranchSha = getBranchCommit(baseBranchName);
      const branchPr = await platform.getBranchPr(branchName);
      if (branchPr) {
        prNo = branchPr.number;
      }
    }
    const automerge = !!branch.automerge;
    let isModified = false;
    if (sha) {
      try {
        isModified = await isBranchModified(branchName);
      } catch (err) /* istanbul ignore next */ {
        // Do nothing
      }
    }
    let isConflicted = false;
    if (sha) {
      try {
        isConflicted = await isBranchConflicted(baseBranchName!, branchName);
      } catch (err) /* istanbul ignore next */ {
        // Do nothing
      }
    }
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    const branchFingerprint = branch.branchFingerprint;
    return {
      branchName,
      sha,
      // TODO: (fix types) #7154
      baseBranchName: baseBranchName!,
      baseBranchSha,
      prNo,
      automerge,
      isModified,
      parentSha,
      upgrades,
      isConflicted,
      branchFingerprint,
    };
  } catch (error) {
    const err = error.err || error; // external host error nests err
    const errCodes = [401, 404];
    // istanbul ignore if
    if (errCodes.includes(err.response?.statusCode)) {
      logger.warn({ err, branchName }, 'HTTP error generating branch cache');
      return null;
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
