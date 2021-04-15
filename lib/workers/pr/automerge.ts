import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { Pr, platform } from '../../platform';
import { BranchStatus } from '../../types';
import { deleteBranch, isBranchModified } from '../../util/git';
import { BranchConfig } from '../types';

export async function checkAutoMerge(
  pr: Pr,
  config: BranchConfig
): Promise<boolean> {
  logger.trace({ config }, 'checkAutoMerge');
  const {
    branchName,
    automergeType,
    automergeComment,
    requiredStatusChecks,
    rebaseRequested,
  } = config;
  // Return if PR not ready for automerge
  if (pr.isConflicted) {
    logger.debug('PR is conflicted');
    logger.debug({ pr });
    return false;
  }
  if (requiredStatusChecks && pr.canMerge !== true) {
    logger.debug(
      { canMergeReason: pr.canMergeReason },
      'PR is not ready for merge'
    );
    return false;
  }
  const branchStatus = await platform.getBranchStatus(
    branchName,
    requiredStatusChecks
  );
  if (branchStatus !== BranchStatus.green) {
    logger.debug(
      `PR is not ready for merge (branch status is ${branchStatus})`
    );
    return false;
  }
  // Check if it's been touched
  if (await isBranchModified(branchName)) {
    logger.debug('PR is ready for automerge but has been modified');
    return false;
  }
  if (automergeType === 'pr-comment') {
    logger.debug(`Applying automerge comment: ${automergeComment}`);
    // istanbul ignore if
    if (getAdminConfig().dryRun) {
      logger.info(
        `DRY-RUN: Would add PR automerge comment to PR #${pr.number}`
      );
      return false;
    }
    if (rebaseRequested) {
      await platform.ensureCommentRemoval({
        number: pr.number,
        content: automergeComment,
      });
    }
    return platform.ensureComment({
      number: pr.number,
      topic: null,
      content: automergeComment,
    });
  }
  // Let's merge this
  logger.debug(`Automerging #${pr.number}`);
  // istanbul ignore if
  if (getAdminConfig().dryRun) {
    logger.info(`DRY-RUN: Would merge PR #${pr.number}`);
    return false;
  }
  const res = await platform.mergePr(pr.number, branchName);
  if (res) {
    logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
    try {
      await deleteBranch(branchName);
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ branchName, err }, 'Branch auto-remove failed');
    }
  }
  return res;
}
