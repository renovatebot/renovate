import {
  ATTR_VCS_REF_BASE_TYPE,
  ATTR_VCS_REF_HEAD_NAME,
  ATTR_VCS_REF_TYPE,
} from '@opentelemetry/semantic-conventions/incubating';
import { isString } from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { addMeta, logger, removeMeta } from '../../../logger/index.ts';
import { hashMap } from '../../../modules/manager/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { BranchCache } from '../../../util/cache/repository/types.ts';
import { fingerprint } from '../../../util/fingerprint.ts';
import { setBranchNewCommit } from '../../../util/git/set-branch-commit.ts';
import { incCountValue, setCount } from '../../global/limits.ts';
import type {
  BranchConfig,
  CacheFingerprintMatchResult,
  UpgradeFingerprintConfig,
} from '../../types.ts';
import { processBranch } from '../update/branch/index.ts';
import { upgradeFingerprintFields } from './fingerprint-fields.ts';
import {
  getCommitsHourlyCount,
  getConcurrentBranchesCount,
  getConcurrentPrsCount,
  getPrHourlyCount,
} from './limits.ts';

export type WriteUpdateResult = 'done' | 'automerged';

export function generateCommitFingerprintConfig(
  branch: BranchConfig,
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

export function compareCacheFingerprint(
  branchState: BranchCache,
  commitFingerprint: string,
): CacheFingerprintMatchResult {
  if (!branchState.commitFingerprint) {
    logger.trace('branch.isUpToDate(): no fingerprint');
    return 'no-fingerprint';
  }

  if (commitFingerprint !== branchState.commitFingerprint) {
    logger.debug('branch.isUpToDate(): needs recalculation');
    return 'no-match';
  }

  logger.debug('branch.isUpToDate(): using cached result "true"');
  return 'matched';
}

export async function syncBranchState(
  branchName: string,
  baseBranch: string,
): Promise<BranchCache> {
  logger.debug('syncBranchState()');
  const branchSha = await scm.getBranchCommit(branchName);
  const baseBranchSha = await scm.getBranchCommit(baseBranch);

  const cache = getCache();
  cache.branches ??= [];
  const { branches: cachedBranches } = cache;
  let branchState = cachedBranches.find((br) => br.branchName === branchName);
  if (!branchState) {
    logger.debug(
      'syncBranchState(): Branch cache not found, creating minimal branchState',
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
    delete branchState.commitFingerprint;

    // Update commit timestamp when SHA changes
    const commitDate = await scm.getBranchUpdateDate(branchName);
    if (commitDate) {
      branchState.commitTimestamp = commitDate.toISO()!;
    }

    // update cached branchSha
    branchState.sha = branchSha;
    branchState.pristine = false;
  }

  return branchState;
}

export async function writeUpdates(
  config: RenovateConfig,
  allBranches: BranchConfig[],
): Promise<WriteUpdateResult> {
  const branches = allBranches;
  logger.debug(
    `Processing ${branches.length} branch${
      branches.length === 1 ? '' : 'es'
    }: ${branches
      .map((b) => b.branchName)
      .sort()
      .join(', ')}`,
  );

  const concurrentPrsCount = await getConcurrentPrsCount(config, branches);
  setCount('ConcurrentPRs', concurrentPrsCount);

  const concurrentBranchesCount = await getConcurrentBranchesCount(branches);
  setCount('Branches', concurrentBranchesCount);

  const prsThisHourCount = await getPrHourlyCount(config);
  setCount('HourlyPRs', prsThisHourCount);

  const commitsThisHourCount = await getCommitsHourlyCount(branches);
  setCount('HourlyCommits', commitsThisHourCount);

  for (const branch of branches) {
    const { baseBranch, branchName } = branch;
    const res = await instrument(
      branchName,
      async () => {
        const meta: Record<string, string> = { branch: branchName };
        if (config.baseBranchPatterns?.length && baseBranch) {
          meta.baseBranch = baseBranch;
        }
        addMeta(meta);
        const branchExisted = await scm.branchExists(branchName);
        const branchState = await syncBranchState(branchName, baseBranch);

        const managers = [
          ...new Set(
            branch.upgrades
              .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
              .filter(isString),
          ),
        ].sort();
        const commitFingerprint = fingerprint({
          commitFingerprintConfig: generateCommitFingerprintConfig(branch),
          managers,
        });
        branch.cacheFingerprintMatch = compareCacheFingerprint(
          branchState,
          commitFingerprint,
        );

        const res = await processBranch(branch);
        branch.prBlockedBy = res?.prBlockedBy;
        branch.prNo = res?.prNo;
        branch.result = res?.result;
        branch.commitFingerprint = res?.updatesVerified
          ? commitFingerprint
          : branchState.commitFingerprint;

        if (res?.commitSha) {
          // Get the commit timestamp for the new commit
          const commitDate = await scm.getBranchUpdateDate(branchName);
          setBranchNewCommit(branchName, baseBranch, res.commitSha, commitDate);
        }
        if (
          branch.result === 'automerged' &&
          branch.automergeType !== 'pr-comment'
        ) {
          // Stop processing other branches because base branch has been changed
          return 'automerged';
        }
        if (!branchExisted && (await scm.branchExists(branch.branchName))) {
          incCountValue('Branches');
        }
      },
      {
        attributes: {
          [ATTR_VCS_REF_TYPE]: 'branch',
          [ATTR_VCS_REF_BASE_TYPE]: 'branch',
          [ATTR_VCS_REF_HEAD_NAME]: branchName,
        },
      },
    );

    if (res !== undefined) {
      return res;
    }
  }
  removeMeta(['branch', 'baseBranch']);
  return 'done';
}
