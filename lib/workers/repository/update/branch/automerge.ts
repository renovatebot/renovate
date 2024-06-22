import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import { isScheduledNow } from './schedule';
import { resolveBranchStatus } from './status-checks';

export type AutomergeResult =
  | 'automerged'
  | 'automerge aborted - PR exists'
  | 'branch status error'
  | 'failed'
  | 'no automerge'
  | 'stale'
  | 'off schedule'
  | 'not ready';

export async function tryBranchAutomerge(
  config: RenovateConfig,
): Promise<AutomergeResult> {
  logger.debug('Checking if we can automerge branch');
  if (!(config.automerge && config.automergeType === 'branch')) {
    return 'no automerge';
  }
  if (!isScheduledNow(config, 'automergeSchedule')) {
    return 'off schedule';
  }
  const existingPr = await platform.getBranchPr(
    config.branchName!,
    config.baseBranch,
  );
  if (existingPr) {
    return 'automerge aborted - PR exists';
  }
  const branchStatus = await resolveBranchStatus(
    config.branchName!,
    !!config.internalChecksAsSuccess,
    config.ignoreTests,
  );
  if (branchStatus === 'green') {
    logger.debug(`Automerging branch`);
    try {
      if (GlobalConfig.get('dryRun')) {
        // TODO: types (#22198)
        logger.info(`DRY-RUN: Would automerge branch ${config.branchName!}`);
      } else {
        await scm.checkoutBranch(config.baseBranch!);
        await scm.mergeAndPush(config.branchName!);
      }
      logger.info({ branch: config.branchName }, 'Branch automerged');
      return 'automerged'; // Branch no longer exists
    } catch (err) /* istanbul ignore next */ {
      if (err.message === 'not ready') {
        logger.debug('Branch is not ready for automerge');
        return 'not ready';
      }
      if (
        err.message.includes('refusing to merge unrelated histories') ||
        err.message.includes('Not possible to fast-forward') ||
        err.message.includes(
          'Updates were rejected because the tip of your current branch is behind',
        )
      ) {
        logger.debug({ err }, 'Branch automerge error');
        logger.info('Branch is not up to date - cannot automerge');
        return 'stale';
      }
      if (err.message.includes('Protected branch')) {
        if (err.message.includes('status check')) {
          logger.debug(
            { err },
            'Branch is not ready for automerge: required status checks are remaining',
          );
          return 'not ready';
        }
        if (err.stack?.includes('reviewers')) {
          logger.info(
            { err },
            'Branch automerge is not possible due to branch protection (required reviewers)',
          );
          return 'failed';
        }
        logger.info(
          { err },
          'Branch automerge is not possible due to branch protection',
        );
        return 'failed';
      }
      logger.warn({ err }, 'Unknown error when attempting branch automerge');
      return 'failed';
    }
  } else if (branchStatus === 'red') {
    return 'branch status error';
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  return 'no automerge';
}
