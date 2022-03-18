import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment';
import { BranchStatus } from '../../../../types';
import {
  deleteBranch,
  isBranchConflicted,
  isBranchModified,
} from '../../../../util/git';
import type { BranchConfig } from '../../../types';
import { resolveBranchStatus } from '../branch/status-checks';

// eslint-disable-next-line typescript-enum/no-enum
export enum PrAutomergeBlockReason {
  BranchModified = 'BranchModified',
  BranchNotGreen = 'BranchNotGreen',
  Conflicted = 'Conflicted',
  DryRun = 'DryRun',
  PlatformNotReady = 'PlatformNotReady',
  PlatformRejection = 'PlatformRejection',
}

export type AutomergePrResult = {
  automerged: boolean;
  branchRemoved?: boolean;
  prAutomergeBlockReason?: PrAutomergeBlockReason;
};

export async function checkAutoMerge(
  pr: Pr,
  config: BranchConfig
): Promise<AutomergePrResult> {
  logger.trace({ config }, 'checkAutoMerge');
  const {
    branchName,
    automergeType,
    automergeStrategy,
    automergeComment,
    ignoreTests,
    rebaseRequested,
  } = config;
  // Return if PR not ready for automerge
  const isConflicted =
    config.isConflicted ??
    (await isBranchConflicted(config.baseBranch, config.branchName));
  if (isConflicted) {
    logger.debug('PR is conflicted');
    return {
      automerged: false,
      prAutomergeBlockReason: PrAutomergeBlockReason.Conflicted,
    };
  }
  if (!ignoreTests && pr.cannotMergeReason) {
    logger.debug(
      `Platform reported that PR is not ready for merge. Reason: [${pr.cannotMergeReason}]`
    );
    return {
      automerged: false,
      prAutomergeBlockReason: PrAutomergeBlockReason.PlatformNotReady,
    };
  }
  const branchStatus = await resolveBranchStatus(
    config.branchName,
    config.ignoreTests
  );
  if (branchStatus !== BranchStatus.green) {
    logger.debug(
      `PR is not ready for merge (branch status is ${branchStatus})`
    );
    return {
      automerged: false,
      prAutomergeBlockReason: PrAutomergeBlockReason.BranchNotGreen,
    };
  }
  // Check if it's been touched
  if (await isBranchModified(branchName)) {
    logger.debug('PR is ready for automerge but has been modified');
    return {
      automerged: false,
      prAutomergeBlockReason: PrAutomergeBlockReason.BranchModified,
    };
  }
  if (automergeType === 'pr-comment') {
    logger.debug(`Applying automerge comment: ${automergeComment}`);
    // istanbul ignore if
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would add PR automerge comment to PR #${pr.number}`
      );
      return {
        automerged: false,
        prAutomergeBlockReason: PrAutomergeBlockReason.DryRun,
      };
    }
    if (rebaseRequested) {
      await ensureCommentRemoval({
        type: 'by-content',
        number: pr.number,
        content: automergeComment,
      });
    }
    await ensureComment({
      number: pr.number,
      topic: null,
      content: automergeComment,
    });
    return { automerged: true, branchRemoved: false };
  }
  // Let's merge this
  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info(
      `DRY-RUN: Would merge PR #${pr.number} with strategy "${automergeStrategy}"`
    );
    return {
      automerged: false,
      prAutomergeBlockReason: PrAutomergeBlockReason.DryRun,
    };
  }
  logger.debug(`Automerging #${pr.number} with strategy ${automergeStrategy}`);
  const res = await platform.mergePr({
    branchName,
    id: pr.number,
    strategy: automergeStrategy,
  });
  if (res) {
    logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
    let branchRemoved = false;
    try {
      await deleteBranch(branchName);
      branchRemoved = true;
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ branchName, err }, 'Branch auto-remove failed');
    }
    return { automerged: true, branchRemoved };
  }
  return {
    automerged: false,
    prAutomergeBlockReason: PrAutomergeBlockReason.PlatformRejection,
  };
}
