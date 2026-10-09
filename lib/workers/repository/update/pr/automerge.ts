// TODO #22198
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import type { BranchConfig } from '../../../types.ts';
import { isScheduledNow } from '../branch/schedule.ts';
import { resolveBranchStatus } from '../branch/status-checks.ts';

export type PrAutomergeBlockReason =
  | 'BranchModified'
  | 'BranchNotGreen'
  | 'Conflicted'
  | 'DryRun'
  | 'InMergeQueue'
  | 'MergePending'
  | 'PlatformNotReady'
  | 'PlatformRejection'
  | 'off schedule';

export interface AutomergePrResult {
  automerged: boolean;
  branchRemoved?: boolean;
  prAutomergeBlockReason?: PrAutomergeBlockReason;
}

// The PR whose merge the platform has not finished yet in this repository run
let pendingMergePr: number | undefined;

export function resetPendingMerge(): void {
  pendingMergePr = undefined;
}

/**
 * Returns the PR whose merge the platform has not finished yet in this
 * repository run. Further automerges are skipped until the next run, because
 * the base branch is about to change.
 */
export function getPendingMergePr(): number | undefined {
  return pendingMergePr;
}

export async function checkAutoMerge(
  pr: Pr,
  config: BranchConfig,
): Promise<AutomergePrResult> {
  logger.trace({ config }, 'checkAutoMerge');
  if (pendingMergePr !== undefined) {
    logger.debug(
      `Skipping automerge of PR #${pr.number} because the merge of PR #${pendingMergePr} is still pending`,
    );
    return {
      automerged: false,
      prAutomergeBlockReason: 'MergePending',
    };
  }
  const {
    branchName,
    baseBranch,
    automergeType,
    automergeStrategy,
    pruneBranchAfterAutomerge,
    automergeComment,
    ignoreTests,
    rebaseRequested,
  } = config;
  // Return if PR not ready for automerge
  if (!isScheduledNow(config, 'automergeSchedule')) {
    logger.debug(`PR automerge is off schedule`);
    return {
      automerged: false,
      prAutomergeBlockReason: 'off schedule',
    };
  }
  const mergeQueueEnabled =
    await platform.isBranchMergeQueueEnabled?.(baseBranch);
  if (mergeQueueEnabled && (await platform.isPrInMergeQueue?.(pr.number))) {
    logger.debug(`PR #${pr.number} is already in the merge queue`);
    return {
      automerged: false,
      prAutomergeBlockReason: 'InMergeQueue',
    };
  }
  const isConflicted =
    config.isConflicted ??
    (await scm.isBranchConflicted(baseBranch, branchName));
  if (isConflicted) {
    logger.debug('PR is conflicted');
    return {
      automerged: false,
      prAutomergeBlockReason: 'Conflicted',
    };
  }
  if (!ignoreTests && pr.cannotMergeReason) {
    logger.debug(
      `Platform reported that PR is not ready for merge. Reason: [${pr.cannotMergeReason}]`,
    );
    return {
      automerged: false,
      prAutomergeBlockReason: 'PlatformNotReady',
    };
  }
  const branchStatus = await resolveBranchStatus(
    branchName,
    !!config.internalChecksAsSuccess,
    config.ignoreTests,
  );
  if (branchStatus !== 'green') {
    logger.debug(
      `PR is not ready for merge (branch status is ${branchStatus})`,
    );
    return {
      automerged: false,
      prAutomergeBlockReason: 'BranchNotGreen',
    };
  }
  if (await scm.isBranchModified(branchName, baseBranch)) {
    logger.debug('PR is ready for automerge but has been modified');
    return {
      automerged: false,
      prAutomergeBlockReason: 'BranchModified',
    };
  }
  if (automergeType === 'pr-comment') {
    // TODO: types (#22198)
    logger.debug(`Applying automerge comment: ${automergeComment!}`);
    // istanbul ignore if
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would add PR automerge comment to PR #${pr.number}`,
      );
      return {
        automerged: false,
        prAutomergeBlockReason: 'DryRun',
      };
    }
    if (rebaseRequested) {
      await ensureCommentRemoval({
        type: 'by-content',
        number: pr.number,
        content: automergeComment!,
      });
    }
    await ensureComment({
      number: pr.number,
      topic: null,
      content: automergeComment!,
    });
    return { automerged: true, branchRemoved: false };
  }
  // Let's merge this
  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    // TODO: types (#22198)
    logger.info(
      `DRY-RUN: Would merge PR #${
        pr.number
      } with strategy "${automergeStrategy!}"`,
    );
    return {
      automerged: false,
      prAutomergeBlockReason: 'DryRun',
    };
  }
  // TODO: types (#22198)
  logger.debug(`Automerging #${pr.number} with strategy ${automergeStrategy!}`);
  const res = await platform.mergePr({
    branchName,
    id: pr.number,
    strategy: automergeStrategy,
  });
  if (res === 'pending') {
    pendingMergePr = pr.number;
    logger.info(
      { pr: pr.number, prTitle: pr.title },
      'PR merge requested, the platform merges it in the background',
    );
    return { automerged: false, prAutomergeBlockReason: 'MergePending' };
  }
  if (res === 'enqueued') {
    logger.info(
      { pr: pr.number, prTitle: pr.title },
      'PR added to the merge queue',
    );
    // The PR is not merged yet and the base branch is unchanged, so this is
    // not reported as automerged. Deleting the branch would close the PR and
    // drop the merge queue entry.
    return {
      automerged: false,
      prAutomergeBlockReason: 'InMergeQueue',
    };
  }
  if (res) {
    logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
    const branchRemoved = await pruneAutomergedBranch(
      branchName,
      pruneBranchAfterAutomerge,
    );
    return { automerged: true, branchRemoved };
  }
  return {
    automerged: false,
    prAutomergeBlockReason: 'PlatformRejection',
  };
}

/**
 * Deletes the branch of an automerged PR if `pruneBranchAfterAutomerge` is
 * set. Returns whether the branch was deleted.
 */
export async function pruneAutomergedBranch(
  branchName: string,
  pruneBranchAfterAutomerge: boolean | undefined,
): Promise<boolean> {
  if (!pruneBranchAfterAutomerge) {
    logger.info('Skipping pruning of merged branch');
    return false;
  }
  try {
    await scm.deleteBranch(branchName);
    return true;
  } catch (err) {
    logger.warn({ branchName, err }, 'Branch auto-remove failed');
    return false;
  }
}
