import is from '@sindresorhus/is';
import hasha from 'hasha';
import stringify from 'safe-stable-stringify';
import type { RenovateConfig } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import { getCache } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import { branchExists, getBranchCommit } from '../../../util/git';
import { setBranchCommit } from '../../../util/git/set-branch-sha';
import { Limit, incLimitedValue, setMaxLimit } from '../../global/limits';
import { BranchConfig, BranchResult } from '../../types';
import { processBranch } from '../update/branch';
import { getBranchesRemaining, getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

export function canSkipBranchUpdateCheck(
  branchCache: BranchCache,
  branchFingerprint: string
): boolean {
  if (!branchCache.branchFingerprint) {
    return false;
  }

  if (branchFingerprint !== branchCache.branchFingerprint) {
    logger.debug('Branch fingerprint has changed, full check required');
    return false;
  }

  logger.debug('Branch fingerprint is unchanged, updates check can be skipped');
  return true;
}

export function syncBranchCache(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string,
  branchCache: BranchCache
): BranchCache {
  // if base branch name has changed it means the PR has been modified
  if (baseBranchName !== branchCache.baseBranchName) {
    branchCache.baseBranchName = baseBranchName;
    delete branchCache.isModified;
  }

  // if branch sha has changed  invalidate all cached values
  if (branchSha !== branchCache.sha) {
    delete branchCache.isConflicted;
    delete branchCache.isModified;
    delete branchCache.branchFingerprint;
    delete branchCache.isBehindBaseBranch;

    // update cached branchSha
    branchCache.sha = branchSha;
  }

  // if base branch sha has changed invalidate values that rely on base branch sha
  if (baseBranchSha !== branchCache.baseBranchSha) {
    delete branchCache.isConflicted;
    delete branchCache.isBehindBaseBranch;

    // update cached branchSha
    branchCache.baseBranchSha = baseBranchSha;
  }

  return branchCache;
}

export async function writeUpdates(
  config: RenovateConfig,
  allBranches: BranchConfig[]
): Promise<WriteUpdateResult> {
  const branches = allBranches;
  logger.debug(
    `Processing ${branches.length} branch${
      branches.length === 1 ? '' : 'es'
    }: ${branches
      .map((b) => b.branchName)
      .sort()
      .join(', ')}`
  );
  const cache = getCache();
  const { branches: cachedBranches = [] } = cache;
  const prsRemaining = await getPrsRemaining(config, branches);
  logger.debug({ prsRemaining }, 'Calculated maximum PRs remaining this run');
  setMaxLimit(Limit.PullRequests, prsRemaining);

  const branchesRemaining = await getBranchesRemaining(config, branches);
  logger.debug(
    { branchesRemaining },
    'Calculated maximum branches remaining this run'
  );
  setMaxLimit(Limit.Branches, branchesRemaining);

  for (const branch of branches) {
    const { baseBranch, branchName } = branch;
    // TODO: fix types (#7154)
    const branchSha = getBranchCommit(branchName)!;
    // TODO: fix types (#7154)
    const baseBrachSha = getBranchCommit(baseBranch!)!;
    const meta: Record<string, string> = { branch: branchName };
    if (config.baseBranches?.length && baseBranch) {
      meta['baseBranch'] = baseBranch;
    }
    addMeta(meta);
    const branchExisted = branchExists(branchName);
    let branchCache = {} as BranchCache;
    if (branchExisted && config.repositoryCache === 'enabled') {
      branchCache =
        cachedBranches?.find((br) => br.branchName === branchName) ??
        ({} as BranchCache);

      if (Object.keys(branchCache).length === 0) {
        logger.debug(
          `Creating branch cache because it does not exist for ${branch.branchName}`
        );
        branchCache.branchName = branchName;
        // TODO: fix types (#7154)
        branchCache.baseBranchName = baseBranch!;
        cachedBranches.push(branchCache);
      }
      // TODO: fix types (#7154)
      branchCache = syncBranchCache(
        branchName,
        branchSha,
        branch.baseBranch!,
        baseBrachSha,
        branchCache
      );
    }
    const branchManagersFingerprint = hasha(
      [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string)
        ),
      ].sort()
    );
    const branchFingerprint = hasha([
      stringify(branch),
      branchManagersFingerprint,
    ]);
    branch.skipBranchUpdate = canSkipBranchUpdateCheck(
      branchCache,
      branchFingerprint
    );

    const res = await processBranch(branch);
    branch.prBlockedBy = res?.prBlockedBy;
    branch.prNo = res?.prNo;
    branch.result = res?.result;
    branch.branchFingerprint =
      res?.commitSha || !branchCache.branchFingerprint
        ? branchFingerprint
        : branchCache.branchFingerprint;

    // reset all cached values if a new commit is made
    if (res?.commitSha) {
      // TODO: (fix types) #7154
      branchCache = {
        ...branchCache,
        ...setBranchCommit(
          branchName,
          res.commitSha,
          baseBranch!,
          baseBrachSha,
          branch.branchFingerprint
        ),
      };
    }
    if (
      branch.result === BranchResult.Automerged &&
      branch.automergeType !== 'pr-comment'
    ) {
      // Stop processing other branches because base branch has been changed
      return 'automerged';
    }
    if (!branchExisted && branchExists(branch.branchName)) {
      incLimitedValue(Limit.Branches);
    }
  }
  removeMeta(['branch', 'baseBranch']);
  return 'done';
}
