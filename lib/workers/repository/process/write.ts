import is from '@sindresorhus/is';
import hasha from 'hasha';
import stringify from 'safe-stable-stringify';
import type { RenovateConfig } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import { getCache } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import { branchExists, getBranchCommit } from '../../../util/git';
import { setBranchNewCommit } from '../../../util/git/set-branch-commit';
import { Limit, incLimitedValue, setMaxLimit } from '../../global/limits';
import { BranchConfig, BranchResult } from '../../types';
import { processBranch } from '../update/branch';
import { getBranchesRemaining, getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

export function canSkipBranchUpdateCheck(
  branchState: BranchCache,
  branchFingerprint: string
): boolean {
  if (!branchState.branchFingerprint) {
    logger.trace('branch.isUpToDate(): no fingerprint');
    return false;
  }

  if (branchFingerprint !== branchState.branchFingerprint) {
    logger.debug('branch.isUpdateToDate(): needs recalculation');
    return false;
  }

  logger.debug('branch.isUpdateToDate(): using cached result "true"');
  return true;
}

export function syncBranchState(
  branchName: string,
  baseBranch: string
): BranchCache {
  logger.debug('syncBranchState()');
  const branchSha = getBranchCommit(branchName)!;
  const baseBranchSha = getBranchCommit(baseBranch)!;

  const cache = getCache();
  cache.branches ??= [];
  const { branches: cachedBranches } = cache;
  let branchState = cachedBranches.find((br) => br.branchName === branchName);
  if (!branchState) {
    logger.debug(
      'syncBranchState(): Branch cache not found, creating minimal branchState'
    );
    // create a minimal branch state
    branchState = {
      branchName,
      sha: branchSha,
      baseBranch,
      baseBranchSha,
    } as BranchCache;
    cachedBranches.push(branchState);
  }

  // if base branch name has changed invalidate cached isModified state
  if (baseBranch !== branchState.baseBranch) {
    logger.debug('syncBranchState(): update baseBranch name');
    branchState.baseBranch = baseBranch!;
    delete branchState.isModified;
  }

  // if base branch sha has changed invalidate cached isBehindBase state
  if (baseBranchSha !== branchState.baseBranchSha) {
    logger.debug('syncBranchState(): update baseBranchSha');
    delete branchState.isBehindBase;

    // update cached branchSha
    branchState.baseBranchSha = baseBranchSha;
  }

  // if branch sha has changed invalidate all cached states
  if (branchSha !== branchState.sha) {
    logger.debug('syncBranchState(): update branchSha');
    delete branchState.isBehindBase;
    delete branchState.isModified;
    delete branchState.branchFingerprint;

    // update cached branchSha
    branchState.sha = branchSha;
  }

  return branchState;
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
    const meta: Record<string, string> = { branch: branchName };
    if (config.baseBranches?.length && baseBranch) {
      meta['baseBranch'] = baseBranch;
    }
    addMeta(meta);
    const branchExisted = branchExists(branchName);
    // TODO: base branch name cannot be undefined - fix optional types (#7154)
    const branchState = syncBranchState(branchName, baseBranch!);

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
      branchState,
      branchFingerprint
    );
    const res = await processBranch(branch);
    branch.prBlockedBy = res?.prBlockedBy;
    branch.prNo = res?.prNo;
    branch.result = res?.result;
    branch.branchFingerprint =
      res?.commitSha || !branchState.branchFingerprint
        ? branchFingerprint
        : branchState.branchFingerprint;

    if (res?.commitSha) {
      // TODO: base branch name cannot be undefined - fix optional types (#7154)
      setBranchNewCommit(branchName, baseBranch!, res.commitSha);
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
