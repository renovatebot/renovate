import { REPOSITORY_CHANGED } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { platform } from '../../modules/platform/index.ts';
import { scm } from '../../modules/platform/scm.ts';
import { getCache } from '../../util/cache/repository/index.ts';
import type {
  BranchCache,
  BranchUpgradeCache,
} from '../../util/cache/repository/types.ts';
import { getCachedBehindBaseResult } from '../../util/git/behind-base-branch-cache.ts';
import { getCachedConflictResult } from '../../util/git/conflicts-cache.ts';
import { getCachedModifiedResult } from '../../util/git/modified-cache.ts';
import { getCachedPristineResult } from '../../util/git/pristine.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../types.ts';
import { getPrCache } from './update/pr/pr-cache.ts';

function generateBranchUpgradeCache(
  upgrade: BranchUpgradeConfig,
): BranchUpgradeCache {
  const {
    datasource,
    depName,
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
  branch: BranchConfig,
): Promise<BranchCache | null> {
  const { baseBranch, branchName, prBlockedBy, prTitle, result } = branch;
  try {
    const branchSha = await scm.getBranchCommit(branchName);
    const baseBranchSha = await scm.getBranchCommit(baseBranch);
    const pristine = getCachedPristineResult(branchName);
    let prNo = null;
    let isModified: boolean | undefined;
    let isBehindBase: boolean | undefined;
    let isConflicted: boolean | undefined;
    let commitTimestamp: string | undefined;
    if (baseBranchSha && branchSha) {
      const branchPr = await platform.getBranchPr(branchName, baseBranch);
      if (branchPr) {
        prNo = branchPr.number;
      }
      isModified = getCachedModifiedResult(branchName, branchSha) ?? undefined;
      isBehindBase =
        getCachedBehindBaseResult(
          branchName,
          branchSha,
          baseBranch,
          baseBranchSha,
        ) ?? undefined;
      isConflicted =
        getCachedConflictResult(
          branchName,
          branchSha,
          baseBranch,
          baseBranchSha,
        ) ?? undefined;
      // Get commit timestamp for hourly limit tracking
      const commitDate = await scm.getBranchUpdateDate(branchName);
      if (commitDate) {
        commitTimestamp = commitDate.toISO()!;
      }
    } else if (baseBranchSha && !branchSha && branch.prNo) {
      // if branch was deleted/ PR exists and ignored
      prNo = branch.prNo;
    }

    const automerge = !!branch.automerge;
    const upgrades: BranchUpgradeCache[] = branch.upgrades
      ? branch.upgrades.map(generateBranchUpgradeCache)
      : [];
    const commitFingerprint = branch.commitFingerprint;
    const prCache = getPrCache(branchName);

    return {
      automerge,
      baseBranchSha,
      baseBranch,
      commitFingerprint,
      commitTimestamp,
      branchName,
      isBehindBase,
      isConflicted,
      isModified,
      prBlockedBy,
      pristine,
      prCache,
      prNo,
      prTitle,
      result,
      sha: branchSha,
      upgrades,
    };
  } catch (error) {
    const err = error.err ?? error; // external host error nests err
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
