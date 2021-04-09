/* istanbul ignore file */

import { logger } from '../../logger';
import { platform } from '../../platform';
import {
  BranchCache,
  BranchUpgradeCache,
  getCache,
} from '../../util/cache/repository';
import {
  getBranchCommit,
  getBranchParentSha,
  isBranchModified,
} from '../../util/git';
import type { BranchConfig, BranchUpgradeConfig } from '../types';

function generateBranchUpgradeCache(
  upgrade: BranchUpgradeConfig
): BranchUpgradeCache {
  const {
    datasource,
    depName,
    lookupName,
    fixedVersion,
    currentVersion,
    newVersion,
    currentDigest,
    newDigest,
    sourceUrl,
  } = upgrade;
  return {
    datasource,
    depName,
    lookupName,
    fixedVersion,
    currentVersion,
    newVersion,
    currentDigest,
    newDigest,
    sourceUrl,
  };
}

async function generateBranchCache(branch: BranchConfig): Promise<BranchCache> {
  const { branchName } = branch;
  try {
    const sha = getBranchCommit(branchName) || null;
    let prNo = null;
    let parentSha = null;
    if (sha) {
      parentSha = await getBranchParentSha(branchName);
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
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    return {
      branchName,
      sha,
      parentSha,
      prNo,
      automerge,
      isModified,
      upgrades,
    };
  } catch (err) {
    // istanbul ignore if
    if (err.response?.statusCode === 404) {
      logger.warn(
        { err, branchName },
        '404 error when generating branch cache'
      );
      return null;
    }
    logger.error({ err, branchName }, 'Error generating branch cache');
    return null;
  }
}

export async function setBranchCache(branches: BranchConfig[]): Promise<void> {
  const branchCache: BranchCache[] = [];
  for (const branch of branches) {
    branchCache.push(await generateBranchCache(branch));
  }
  getCache().branches = branchCache.filter(Boolean);
}
