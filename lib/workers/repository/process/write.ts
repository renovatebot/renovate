import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import { getCache } from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import { branchExists, getBranchCommit } from '../../../util/git';
import { setBranchNewCommit } from '../../../util/git/set-branch-commit';
import { incLimitedValue, setMaxLimit } from '../../global/limits';
import type { BranchConfig, UpgradeFingerprintConfig } from '../../types';
import { processBranch } from '../update/branch';
import { upgradeFingerprintFields } from './fingerprint-fields';
import { getBranchesRemaining, getPrsRemaining } from './limits';

export type WriteUpdateResult = 'done' | 'automerged';

export function generateBranchFingerprintConfig(
  branch: BranchConfig
): UpgradeFingerprintConfig[] {
  const res = branch.upgrades.map((upgrade) => {
    const filteredUpgrade = {} as UpgradeFingerprintConfig;
    for (const field of upgradeFingerprintFields) {
      filteredUpgrade[field] = upgrade[field];
    }
    return filteredUpgrade;
  });

  return res;
}

export function canSkipBranchUpdateCheck(
  branchState: BranchCache,
  branchFingerprint: string
): boolean {
  if (!branchState.branchFingerprint) {
    logger.trace('branch.isUpToDate(): no fingerprint');
    return false;
  }

  if (branchFingerprint !== branchState.branchFingerprint) {
    logger.debug('branch.isUpToDate(): needs recalculation');
    return false;
  }

  logger.debug('branch.isUpToDate(): using cached result "true"');
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
    branchState.baseBranch = baseBranch;
    delete branchState.isModified;
    branchState.pristine = false;
  }

  // if base branch sha has changed invalidate cached isBehindBase state
  if (baseBranchSha !== branchState.baseBranchSha) {
    logger.debug('syncBranchState(): update baseBranchSha');
    delete branchState.isBehindBase;
    delete branchState.isConflicted;

    // update cached branchSha
    branchState.baseBranchSha = baseBranchSha;
    branchState.pristine = false;
  }

  // if branch sha has changed invalidate all cached states
  if (branchSha !== branchState.sha) {
    logger.debug('syncBranchState(): update branchSha');
    delete branchState.isBehindBase;
    delete branchState.isConflicted;
    delete branchState.isModified;
    delete branchState.branchFingerprint;

    // update cached branchSha
    branchState.sha = branchSha;
    branchState.pristine = false;
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
  logger.debug(`Calculated maximum PRs remaining this run: ${prsRemaining}`);
  setMaxLimit('PullRequests', prsRemaining);

  const branchesRemaining = await getBranchesRemaining(config, branches);
  logger.debug(
    `Calculated maximum branches remaining this run: ${branchesRemaining}`
  );
  setMaxLimit('Branches', branchesRemaining);

  for (const branch of branches) {
    const { baseBranch, branchName } = branch;
    const meta: Record<string, string> = { branch: branchName };
    if (config.baseBranches?.length && baseBranch) {
      meta['baseBranch'] = baseBranch;
    }
    addMeta(meta);
    const branchExisted = branchExists(branchName);
    const branchState = syncBranchState(branchName, baseBranch);

    const managers = [
      ...new Set(
        branch.upgrades
          .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
          .filter(is.string)
      ),
    ].sort();
    const branchFingerprint = fingerprint({
      branchFingerprintConfig: generateBranchFingerprintConfig(branch),
      managers,
    });
    branch.skipBranchUpdate = canSkipBranchUpdateCheck(
      branchState,
      branchFingerprint
    );
    const res = await processBranch(branch);
    branch.prBlockedBy = res?.prBlockedBy;
    branch.prNo = res?.prNo;
    branch.result = res?.result;
    branch.branchFingerprint = res?.updatesVerified
      ? branchFingerprint
      : branchState.branchFingerprint;

    if (res?.commitSha) {
      setBranchNewCommit(branchName, baseBranch, res.commitSha);
    }
    if (
      branch.result === 'automerged' &&
      branch.automergeType !== 'pr-comment'
    ) {
      // Stop processing other branches because base branch has been changed
      return 'automerged';
    }
    if (!branchExisted && branchExists(branch.branchName)) {
      incLimitedValue('Branches');
    }
  }
  removeMeta(['branch', 'baseBranch']);
  return 'done';
}
