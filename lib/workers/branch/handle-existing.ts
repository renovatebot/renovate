import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { Pr, platform } from '../../platform';
import { PrState } from '../../types';
import { branchExists, deleteBranch } from '../../util/git';
import { BranchConfig } from '../types';

export async function handlepr(config: BranchConfig, pr: Pr): Promise<void> {
  if (pr.state === PrState.Closed) {
    let content;
    if (config.updateType === 'major') {
      content = `As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future ${config.newMajor}.x releases. However, if you upgrade to ${config.newMajor}.x manually then Renovate will then reenable updates for minor and patch updates automatically.`;
    } else if (config.updateType === 'digest') {
      content = `As this PR has been closed unmerged, Renovate will ignore this upgrade updateType and you will not receive PRs for *any* future ${config.depName}:${config.currentValue} digest updates. Digest updates will resume if you update the specified tag at any time.`;
    } else {
      content = `As this PR has been closed unmerged, Renovate will now ignore this update (${config.newValue}). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
    }
    content +=
      '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
    if (!config.suppressNotifications.includes('prIgnoreNotification')) {
      const ignoreTopic = `Renovate Ignore Notification`;
      if (getAdminConfig().dryRun) {
        logger.info(
          `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`
        );
      } else {
        await platform.ensureComment({
          number: pr.number,
          topic: ignoreTopic,
          content,
        });
      }
    }
    if (branchExists(config.branchName)) {
      if (getAdminConfig().dryRun) {
        logger.info('DRY-RUN: Would delete branch ' + config.branchName);
      } else {
        await deleteBranch(config.branchName);
      }
    }
  } else if (pr.state === PrState.Merged) {
    logger.debug({ pr: pr.number }, 'Merged PR is blocking this branch');
  }
}
