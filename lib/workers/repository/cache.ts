/* istanbul ignore file */

import { logger } from '../../logger';
import { platform } from '../../platform';
import {
  BranchCache,
  BranchUpgradeCache,
  getCache,
} from '../../util/cache/repository';
import { getBranchCommit, isBranchModified } from '../../util/git';
import { BranchConfig, BranchUpgradeConfig } from '../common';

function generateBranchUpgradeCache(
  upgrade: BranchUpgradeConfig
): BranchUpgradeCache {
  const {
    datasource,
    depName,
    lookupName,
    fixedVersion,
    fromVersion,
    toVersion,
    currentDigest,
    newDigest,
  } = upgrade;
  return {
    datasource,
    depName,
    lookupName,
    fixedVersion,
    fromVersion,
    toVersion,
    currentDigest,
    newDigest,
  };
}

async function generateBranchCache(branch: BranchConfig): Promise<BranchCache> {
  const { branchName } = branch;
  try {
    const sha = getBranchCommit(branchName) || null;
    let prNo = null;
    if (sha) {
      const branchPr = await platform.getBranchPr(branchName);
      if (branchPr) {
        prNo = branchPr.number;
      }
    }
    const automerge = !!branch.automerge;
    const isModified = sha ? await isBranchModified(branchName) : false;
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    return { branchName, sha, prNo, automerge, isModified, upgrades };
  } catch (err) {
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
