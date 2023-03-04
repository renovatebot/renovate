/* istanbul ignore file */

import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { platform } from '../../modules/platform';
import { scm } from '../../modules/platform/scm';
import { getCache } from '../../util/cache/repository';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../util/cache/repository/types';
import { getCachedPristineResult } from '../../util/git/pristine';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import { getPrCache } from './update/pr/pr-cache';

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
    const sha = await scm.getBranchCommit(branchName);
    const baseBranchSha = await scm.getBranchCommit(baseBranch);
    const pristine = getCachedPristineResult(branchName);
    let prNo = null;
    let isModified = false;
    let isBehindBase = false;
    let isConflicted = false;
    if (sha) {
      const branchPr = await platform.getBranchPr(branchName);
      if (branchPr) {
        prNo = branchPr.number;
      }
      isModified = await scm.isBranchModified(branchName);
      isBehindBase = await scm.isBranchBehindBase(branchName, baseBranch);
      isConflicted = await scm.isBranchConflicted(baseBranch, branchName);
    }
    const automerge = !!branch.automerge;
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    const branchFingerprint = branch.branchFingerprint;
    const prCache = getPrCache(branchName);
    return {
      automerge,
      baseBranchSha,
      baseBranch,
      branchFingerprint,
      branchName,
      isBehindBase,
      isConflicted,
      isModified,
      pristine,
      prCache,
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
