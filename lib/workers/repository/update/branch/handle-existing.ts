import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment';
import { PrState } from '../../../../types';
import { emojify } from '../../../../util/emoji';
import { branchExists, deleteBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import type { BranchConfig } from '../../../types';

export async function handlepr(config: BranchConfig, pr: Pr): Promise<void> {
  switch (pr.state) {
    case PrState.Open:
      await handleOpenPr(config, pr);
      break;
    case PrState.Closed:
    case PrState.Merged:
      await handleNonOpenPr(config, pr);
      break;
    default:
      break;
  }
}

async function handleNonOpenPr(config: BranchConfig, pr: Pr): Promise<void> {
  if (pr.state === PrState.Closed) {
    let content;
    // TODO #7154
    const userStrings = config.userStrings!;
    if (config.updateType === 'major') {
      content = template.compile(userStrings.ignoreMajor, config);
    } else if (config.updateType === 'digest') {
      content = template.compile(userStrings.ignoreDigest, config);
    } else {
      content = template.compile(userStrings.ignoreOther, config);
    }
    content +=
      '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
    if (!config.suppressNotifications!.includes('prIgnoreNotification')) {
      if (GlobalConfig.get('dryRun')) {
        logger.info(
          `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`
        );
      } else {
        await ensureComment({
          number: pr.number,
          topic: userStrings.ignoreTopic,
          content,
        });
      }
    }
    if (branchExists(config.branchName)) {
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Would delete branch ' + config.branchName);
      } else {
        await deleteBranch(config.branchName);
      }
    }
  } else if (pr.state === PrState.Merged) {
    logger.debug(`Merged PR with PrNo: ${pr.number} is blocking this branch`);
  }
}

export async function handleOpenPr(
  config: BranchConfig,
  pr: Pr
): Promise<void> {
  if (config.suppressNotifications!.includes('prEditedNotification')) {
    return;
  }

  const editedPrCommentTopic = 'Edited/Blocked Notification';
  const content =
    'Renovate will not automatically rebase this PR, because other commits have been found.\n' +
    'You can manually request rebase by checking the rebase/retry box above.\n\n' +
    emojify(' :warning: **Warning**: custom changes will be lost.');

  const dependencyDashboardCheck =
    config.dependencyDashboardChecks?.[config.branchName];

  if (dependencyDashboardCheck || config.rebaseRequested) {
    logger.debug('Manual rebase has been requested for PR');
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would remove edited/blocked PR comment in PR #${pr.number}`
      );
      return;
    }

    await ensureCommentRemoval({
      type: 'by-topic',
      number: pr.number,
      topic: editedPrCommentTopic,
    });
  } else {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would ensure edited/blocked PR comment in PR #${pr.number}`
      );
      return;
    }

    logger.debug('Ensuring comment to indicate that rebasing is not possible');
    await ensureComment({
      number: pr.number,
      topic: editedPrCommentTopic,
      content,
    });
  }
}
