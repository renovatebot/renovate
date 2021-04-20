import { getAdminConfig } from '../../../config/admin';
import type { RenovateConfig } from '../../../config/types';
import { REPOSITORY_CHANGED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { PrState } from '../../../types';
import {
  deleteBranch,
  getBranchList,
  isBranchModified,
} from '../../../util/git';

async function cleanUpBranches(
  { pruneStaleBranches: enabled }: RenovateConfig,
  remainingBranches: string[]
): Promise<void> {
  if (enabled === false) {
    logger.debug('Branch/PR pruning is disabled - skipping');
    return;
  }
  for (const branchName of remainingBranches) {
    try {
      const pr = await platform.findPr({
        branchName,
        state: PrState.Open,
      });
      const branchIsModified = await isBranchModified(branchName);
      if (pr) {
        if (branchIsModified) {
          logger.debug(
            { prNo: pr.number, prTitle: pr.title },
            'Branch is modified - skipping PR autoclosing'
          );
          if (getAdminConfig().dryRun) {
            logger.info(`DRY-RUN: Would add Autoclosing Skipped comment to PR`);
          } else {
            await platform.ensureComment({
              number: pr.number,
              topic: 'Autoclosing Skipped',
              content:
                'This PR has been flagged for autoclosing, however it is being skipped due to the branch being already modified. Please close/delete it manually or report a bug if you think this is in error.',
            });
          }
        } else if (getAdminConfig().dryRun) {
          logger.info(
            { prNo: pr.number, prTitle: pr.title },
            `DRY-RUN: Would autoclose PR`
          );
        } else {
          logger.info(
            { branchName, prNo: pr.number, prTitle: pr.title },
            'Autoclosing PR'
          );
          let newPrTitle = pr.title;
          if (!pr.title.endsWith('- autoclosed')) {
            newPrTitle += ' - autoclosed';
          }
          await platform.updatePr({
            number: pr.number,
            prTitle: newPrTitle,
            state: PrState.Closed,
          });
          await deleteBranch(branchName);
        }
      } else if (getAdminConfig().dryRun) {
        logger.info(`DRY-RUN: Would delete orphan branch ${branchName}`);
      } else {
        logger.info({ branch: branchName }, `Deleting orphan branch`);
        await deleteBranch(branchName);
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message?.includes("bad revision 'origin/")) {
        logger.debug(
          { branchName },
          'Branch not found on origin when attempting to prune'
        );
      } else if (err.message !== REPOSITORY_CHANGED) {
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
  let renovateBranches = getBranchList().filter((branchName) =>
    branchName.startsWith(config.branchPrefix)
  );
  if (!renovateBranches?.length) {
    logger.debug('No renovate branches found');
    return;
  }
  logger.debug(
    {
      branchList: branchList?.sort(),
      renovateBranches: renovateBranches?.sort(),
    },
    'Branch lists'
  );
  const lockFileBranch = `${config.branchPrefix}lock-file-maintenance`;
  renovateBranches = renovateBranches.filter(
    (branch) => branch !== lockFileBranch
  );
  const remainingBranches = renovateBranches.filter(
    (branch) => !branchList.includes(branch)
  );
  logger.debug(`remainingBranches=${String(remainingBranches)}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }

  await cleanUpBranches(config, remainingBranches);
}
