import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { REPOSITORY_CHANGED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import { scm } from '../../../modules/platform/scm';
import { getBranchList, setUserRepoConfig } from '../../../util/git';
import { getReconfigureBranchName } from '../reconfigure';

async function cleanUpBranches(
  config: RenovateConfig,
  remainingBranches: string[],
): Promise<void> {
  if (!config.pruneStaleBranches) {
    logger.debug('Branch/PR pruning is disabled - skipping');
    return;
  }
  // set Git author in case the repository is not initialized yet
  setUserRepoConfig(config);
  for (const branchName of remainingBranches) {
    try {
      const pr = await platform.findPr({
        branchName,
        state: 'open',
        targetBranch: config.baseBranch,
      });
      const branchIsModified = await scm.isBranchModified(branchName);
      if (pr) {
        if (branchIsModified) {
          logger.debug(
            { prNo: pr.number, prTitle: pr.title },
            'Branch is modified - skipping PR autoclosing',
          );
          if (GlobalConfig.get('dryRun')) {
            logger.info(`DRY-RUN: Would update PR title and ensure comment.`);
          } else {
            if (!pr.title.endsWith('- abandoned')) {
              const newPrTitle = pr.title + ' - abandoned';
              await platform.updatePr({
                number: pr.number,
                prTitle: newPrTitle,
                state: 'open',
              });
            }

            await ensureComment({
              number: pr.number,
              topic: 'Autoclosing Skipped',
              content:
                'This PR has been flagged for autoclosing. However, it is being skipped due to the branch being already modified. Please close/delete it manually or report a bug if you think this is in error.',
            });
          }
        } else if (GlobalConfig.get('dryRun')) {
          logger.info(
            { prNo: pr.number, prTitle: pr.title },
            `DRY-RUN: Would autoclose PR`,
          );
        } else {
          logger.info(
            { branchName, prNo: pr.number, prTitle: pr.title },
            'Autoclosing PR',
          );
          let newPrTitle = pr.title;
          if (!pr.title.endsWith('- autoclosed')) {
            newPrTitle += ' - autoclosed';
          }
          await platform.updatePr({
            number: pr.number,
            prTitle: newPrTitle,
            state: 'closed',
          });
          await scm.deleteBranch(branchName);
        }
      } else if (branchIsModified) {
        logger.debug('Orphan Branch is modified - skipping branch deletion');
      } else if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would delete orphan branch ${branchName}`);
      } else {
        logger.info({ branch: branchName }, `Deleting orphan branch`);
        await scm.deleteBranch(branchName);
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message === 'config-validation') {
        logger.debug(
          'Cannot prune branch due to collision between tags and branch names',
        );
      } else if (err.message?.includes("bad revision 'origin/")) {
        logger.debug(
          { branchName },
          'Branch not found on origin when attempting to prune',
        );
      } else if (err.message !== REPOSITORY_CHANGED) {
        logger.warn({ err, branch: branchName }, 'Error pruning branch');
      }
    }
  }
}

export async function pruneStaleBranches(
  config: RenovateConfig,
  branchList: string[] | null | undefined,
): Promise<void> {
  logger.debug('Removing any stale branches');
  logger.trace({ config }, `pruneStaleBranches`);
  // TODO: types (#22198)
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded!}`);
  if (!branchList) {
    logger.debug('No branchList');
    return;
  }
  // TODO: types (#22198)
  let renovateBranches = getBranchList().filter(
    (branchName) =>
      branchName.startsWith(config.branchPrefix!) &&
      branchName !== getReconfigureBranchName(config.branchPrefix!),
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
    'Branch lists',
  );
  // TODO: types (#22198)
  const lockFileBranch = `${config.branchPrefix!}lock-file-maintenance`;
  renovateBranches = renovateBranches.filter(
    (branch) => branch !== lockFileBranch,
  );
  const remainingBranches = renovateBranches.filter(
    (branch) => !branchList.includes(branch),
  );
  logger.debug(`remainingBranches=${String(remainingBranches)}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }

  await cleanUpBranches(config, remainingBranches);
}
