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
  getBranchParentSha,
  isBranchBehindBase,
  isBranchConflicted,
  isBranchModified,
} from '../../util/git';
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
  const { baseBranch, branchName } = branch;
  try {
    const sha = getBranchCommit(branchName);
    const baseBranchSha = getBranchCommit(baseBranch!)!;
    let prNo = null;
    let parentSha = null;

    const automerge = !!branch.automerge;
    let isModified = false;
    let isBehindBase = false;
    let isConflicted = false;
    if (sha) {
      parentSha = await getBranchParentSha(branchName);
      const branchPr = await platform.getBranchPr(branchName);
      if (branchPr) {
        prNo = branchPr.number;
      }
      try {
        isModified = await isBranchModified(branchName);
      } catch (err) /* istanbul ignore next */ {
        // Do nothing
      }
      try {
        // TODO: fix types (#7154)
        isBehindBase = await isBranchBehindBase(branchName, baseBranch!);
      } catch (err) /* istanbul ignore next */ {
        // Do nothing
      }

      try {
        // TODO: fix types (#7154)
        isConflicted = await isBranchConflicted(baseBranch!, branchName);
      } catch (err) /* istanbul ignore next */ {
        // Do nothing
      }
    }
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    const branchFingerprint = branch.branchFingerprint;
    return {
      automerge,
      baseBranch: baseBranch!,
      baseBranchSha,
      branchFingerprint,
      branchName,
      isBehindBase,
      isConflicted,
      isModified,
      parentSha,
      prNo,
      sha,
      upgrades,
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
