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

function syncBranchCache(
  branchName: string,
  branchSha: string,
  baseBranchName: string,
  baseBranchSha: string,
  branchCache: BranchCache
): void {
  if (baseBranchName !== branchCache.baseBranchName) {
    branchCache.baseBranchName = baseBranchName;
    delete branchCache.isModified;
  }

  if (branchSha !== branchCache.sha) {
    // invalidate isModified, isConflicted values
    delete branchCache.isConflicted;
    delete branchCache.isModified;
    delete branchCache.branchFingerprint;
    delete branchCache.isBehindBaseBranch;

    // update cached branchSha
    branchCache.sha = branchSha;
  }

  if (baseBranchSha !== branchCache.baseBranchSha) {
    // invalidate isModified, isConflicted values
    delete branchCache.isConflicted;
    delete branchCache.isBehindBaseBranch;

    // update cached branchSha
    branchCache.baseBranchSha = baseBranchSha;
  }
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
    const branchSha = getBranchCommit(branchName)!;
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
          `Creating branch cache becasue none found for ${branch.branchName}`
        );
        // if branch cache not found initialize it
        cachedBranches.push(branchCache);
        branchCache.branchName = branchName;
        // TODO: fix types (#7154)
        branchCache.baseBranchName = baseBranch!;
      }

      // TODO: fix types (#7154)
      syncBranchCache(
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

    if (res?.commitSha) {
      // reset all cached values
      // TODO: (fix types) #7154
      setBranchCommit(
        branchName,
        res.commitSha,
        baseBranch!,
        baseBrachSha,
        branch?.branchFingerprint
      );
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
