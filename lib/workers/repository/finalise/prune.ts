import moment from 'moment';
import { RenovateConfig } from '../../../config';
import { REPOSITORY_CHANGED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { PrState } from '../../../types';
import {
  deleteBranch,
  getAllRenovateBranches,
  getBranchLastCommitTime,
  isBranchModified,
  touchBranch,
} from '../../../util/git';

async function cleanUpBranches(
  { dryRun, pruneStaleBranches: enabled }: RenovateConfig,
  remainingBranches: string[]
): Promise<void> {
  for (const branchName of remainingBranches) {
    try {
      const pr = await platform.findPr({
        branchName,
        state: PrState.Open,
      });
      const branchIsModified = await isBranchModified(branchName);
      let closedRightNow = false;
      if (pr && !branchIsModified) {
        if (!pr.title.endsWith('- autoclosed')) {
          if (dryRun) {
            logger.info(
              `DRY-RUN: Would update pr ${pr.number} to ${pr.title} - autoclosed`
            );
          } else if (enabled === false) {
            logger.info(
              `PRUNING-DISABLED: Would update pr ${pr.number} to ${pr.title} - autoclosed`
            );
          } else {
            if (
              platform.supportsPrReopen &&
              !branchIsModified &&
              pr.state === PrState.Open
            ) {
              await touchBranch(branchName);
              closedRightNow = true;
            }
            await platform.updatePr({
              number: pr.number,
              prTitle: `${pr.title} - autoclosed`,
              state: PrState.Closed,
            });
          }
        }
      }

      if (branchIsModified) {
        if (pr) {
          logger.debug(
            { prNo: pr?.number, prTitle: pr?.title },
            'Skip PR autoclosing'
          );
          if (dryRun) {
            logger.info(`DRY-RUN: Would add Autoclosing Skipped comment to PR`);
          } else {
            await platform.ensureComment({
              number: pr.number,
              topic: 'Autoclosing Skipped',
              content:
                'This PR has been flagged for autoclosing, however it is being skipped due to the branch being already modified. Please close/delete it manually or report a bug if you think this is in error.',
            });
          }
        }
      } else if (dryRun) {
        logger.info(`DRY-RUN: Would deleting orphan branch ${branchName}`);
      } else if (enabled === false) {
        logger.info(
          `PRUNING-DISABLED: Would deleting orphan branch ${branchName}`
        );
      } else if (platform.supportsPrReopen) {
        if (!closedRightNow) {
          const lastCommitTime = await getBranchLastCommitTime(branchName);
          const minutesFromLastCommit = moment().diff(lastCommitTime, 'm');
          if (minutesFromLastCommit >= 3 * 24 * 60) {
            logger.debug(
              { branch: branchName },
              'Deleting orphan branch by timeout'
            );
            await deleteBranch(branchName);
          } else {
            /* istanbul ignore next */
            logger.debug(
              { branch: branchName },
              'Orphan branch deletion is delayed'
            );
          }
        }
      } else {
        logger.debug({ branch: branchName }, 'Deleting orphan branch');
        await deleteBranch(branchName);
      }
      if (pr && !branchIsModified) {
        logger.info({ prNo: pr.number, prTitle: pr.title }, 'PR autoclosed');
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message !== REPOSITORY_CHANGED) {
        logger.warn({ err, branch: branchName }, 'Error pruning branch');
      }
    }
  }
}

export async function pruneStaleBranches(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  logger.debug('Removing any stale branches');
  logger.trace({ config }, `pruneStaleBranches`);
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  if (!branchList) {
    logger.debug('No branchList');
    return;
  }
  let renovateBranches = await getAllRenovateBranches(config.branchPrefix);
  if (!renovateBranches?.length) {
    logger.debug('No renovate branches found');
    return;
  }
  logger.debug({ branchList, renovateBranches }, 'Branch lists');
  const lockFileBranch = `${config.branchPrefix}lock-file-maintenance`;
  renovateBranches = renovateBranches.filter(
    (branch) => branch !== lockFileBranch
  );
  const remainingBranches = renovateBranches.filter(
    (branch) => !branchList.includes(branch)
  );
  logger.debug(`remainingBranches=${remainingBranches}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }

  await cleanUpBranches(config, remainingBranches);
}
