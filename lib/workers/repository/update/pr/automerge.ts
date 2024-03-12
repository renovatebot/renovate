// TODO #22198
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment';
import { scm } from '../../../../modules/platform/scm';
import type { BranchConfig } from '../../../types';
import { isScheduledNow } from '../branch/schedule';
import { resolveBranchStatus } from '../branch/status-checks';

export type PrAutomergeBlockReason =
  | 'BranchModified'
  | 'BranchNotGreen'
  | 'Conflicted'
  | 'DryRun'
  | 'PlatformNotReady'
  | 'PlatformRejection'
  | 'off schedule';

export interface AutomergePrResult {
  automerged: boolean;
  branchRemoved?: boolean;
  prAutomergeBlockReason?: PrAutomergeBlockReason;
}

export async function checkAutoMerge(
  pr: Pr,
  config: BranchConfig,
): Promise<AutomergePrResult> {
  logger.trace({ config }, 'checkAutoMerge');
  const {
    branchName,
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
  const isConflicted =
    config.isConflicted ??
    (await scm.isBranchConflicted(config.baseBranch, config.branchName));
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
    config.branchName,
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
  // Check if it's been touched
  if (await scm.isBranchModified(branchName)) {
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
  if (res) {
    logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
    if (!pruneBranchAfterAutomerge) {
      logger.info('Skipping pruning of merged branch');
      return { automerged: true, branchRemoved: false };
    }
    let branchRemoved = false;
    try {
      await scm.deleteBranch(branchName);
      branchRemoved = true;
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ branchName, err }, 'Branch auto-remove failed');
    }
    return { automerged: true, branchRemoved };
  }
  return {
    automerged: false,
    prAutomergeBlockReason: 'PlatformRejection',
  };
}
