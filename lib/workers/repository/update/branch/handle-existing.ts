import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment';
import { scm } from '../../../../modules/platform/scm';
import { emojify } from '../../../../util/emoji';
import * as template from '../../../../util/template';
import type { BranchConfig } from '../../../types';

export async function handleClosedPr(
  config: BranchConfig,
  pr: Pr,
): Promise<void> {
  if (pr.state === 'closed') {
    let content;
    // TODO #22198
    const userStrings = config.userStrings!;
    if (config.updateType === 'major') {
      content = template.compile(userStrings.ignoreMajor, config);
    } else if (config.updateType === 'digest') {
      content = template.compile(userStrings.ignoreDigest, config);
    } else {
      content = template.compile(userStrings.ignoreOther, config);
    }
    content +=
      '\n\nIf you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.';
    if (!config.suppressNotifications!.includes('prIgnoreNotification')) {
      if (GlobalConfig.get('dryRun')) {
        logger.info(
          `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`,
        );
      } else {
        await ensureComment({
          number: pr.number,
          topic: userStrings.ignoreTopic,
          content,
        });
      }
    }
    if (await scm.branchExists(config.branchName)) {
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Would delete branch ' + config.branchName);
      } else {
        await scm.deleteBranch(config.branchName);
      }
    }
  }
}

export async function handleModifiedPr(
  config: BranchConfig,
  pr: Pr,
): Promise<void> {
  if (config.suppressNotifications!.includes('prEditedNotification')) {
    return;
  }

  const editedPrCommentTopic = 'Edited/Blocked Notification';
  const content =
    'Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.\n\n' +
    'You can manually request rebase by checking the rebase/retry box above.\n\n' +
    emojify(' :warning: **Warning**: custom changes will be lost.');

  const dependencyDashboardCheck =
    config.dependencyDashboardChecks?.[config.branchName];

  if (!!dependencyDashboardCheck || config.rebaseRequested) {
    logger.debug('Manual rebase has been requested for PR');
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would remove edited/blocked PR comment in PR #${pr.number}`,
      );
      return;
    }
    logger.debug(`Removing edited/blocked PR comment in PR #${pr.number}`);
    await ensureCommentRemoval({
      type: 'by-topic',
      number: pr.number,
      topic: editedPrCommentTopic,
    });
  } else {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would ensure edited/blocked PR comment in PR #${pr.number}`,
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
