import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import { PrState } from '../../../../types';
import { branchExists, deleteBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import type { BranchConfig } from '../../../types';

export async function handlepr(config: BranchConfig, pr: Pr): Promise<void> {
  if (pr.state === PrState.Closed) {
    let content;
    if (config.updateType === 'major') {
      content = template.compile(config.userStrings.ignoreMajor, config);
    } else if (config.updateType === 'digest') {
      content = template.compile(config.userStrings.ignoreDigest, config);
    } else {
      content = template.compile(config.userStrings.ignoreOther, config);
    }
    content +=
      '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
    if (!config.suppressNotifications.includes('prIgnoreNotification')) {
      if (GlobalConfig.get('dryRun')) {
        logger.info(
          `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`
        );
      } else {
        await ensureComment({
          number: pr.number,
          topic: config.userStrings.ignoreTopic,
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
    logger.debug({ pr: pr.number }, 'Merged PR is blocking this branch');
  }
}
