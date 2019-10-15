import { logger } from '../../logger';
import { RenovateConfig } from '../../config';
import { platform } from '../../platform';

export type AutomergeResult =
  | 'automerged'
  | 'automerge aborted - PR exists'
  | 'branch status error'
  | 'failed'
  | 'no automerge'
  | 'not ready';

export async function tryBranchAutomerge(
  config: RenovateConfig
): Promise<AutomergeResult> {
  logger.debug('Checking if we can automerge branch');
  if (!(config.automerge && config.automergeType === 'branch')) {
    return 'no automerge';
  }
  const existingPr = await platform.getBranchPr(config.branchName);
  if (existingPr) {
    return 'automerge aborted - PR exists';
  }
  const branchStatus = await platform.getBranchStatus(
    config.branchName,
    config.requiredStatusChecks
  );
  if (branchStatus === 'success') {
    logger.debug(`Automerging branch`);
    try {
      if (config.dryRun)
        logger.info('DRY-RUN: Would automerge branch' + config.branchName);
      else await platform.mergeBranch(config.branchName);
      logger.info({ branch: config.branchName }, 'Branch automerged');
      return 'automerged'; // Branch no longer exists
    } catch (err) {
      // istanbul ignore if
      if (err.message === 'not ready') {
        logger.info('Branch is not ready for automerge');
        return 'not ready';
      }
      logger.info({ err }, `Failed to automerge branch`);
      return 'failed';
    }
  } else if (['failure', 'error'].includes(branchStatus)) {
    return 'branch status error';
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  return 'no automerge';
}
