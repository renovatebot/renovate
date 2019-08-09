const { logger } = require('../../../logger');

module.exports = {
  pruneStaleBranches,
};

async function cleanUpBranches(
  { dryRun, pruneStaleBranches: enabled },
  remainingBranches
) {
  for (const branchName of remainingBranches) {
    try {
      const pr = await platform.findPr(branchName, null, 'open');
      const branchPr = await platform.getBranchPr(branchName);
      const skipAutoclose = branchPr && !branchPr.canRebase;
      if (pr && !skipAutoclose) {
        if (!pr.title.endsWith('- autoclosed')) {
          if (dryRun) {
            logger.info(
              `DRY-RUN: Would update pr ${pr.number} to ${pr.title} - autoclosed`
            );
          } else if (enabled === false) {
            logger.info(
              `PRUNING-DISABLED: Would update pr ${pr.number} to ${pr.title} - autoclosed`
            );
          } else await platform.updatePr(pr.number, `${pr.title} - autoclosed`);
        }
      }
      const closePr = true;
      logger.info({ branch: branchName }, `Deleting orphan branch`);
      if (skipAutoclose) {
        logger.info(
          { prNo: pr.number, prTitle: pr.title },
          'Skip PR autoclosing'
        );
        if (pr) {
          await platform.ensureComment(pr.number, 'FIXME', 'FIXME');
        }
      } else if (dryRun) {
        logger.info(`DRY-RUN: Would deleting orphan branch ${branchName}`);
      } else if (enabled === false) {
        logger.info(
          `PRUNING-DISABLED: Would deleting orphan branch ${branchName}`
        );
      } else await platform.deleteBranch(branchName, closePr);
      if (pr && !skipAutoclose) {
        logger.info({ prNo: pr.number, prTitle: pr.title }, 'PR autoclosed');
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message !== 'repository-changed') {
        logger.warn({ err, branch: branchName }, 'Error pruning branch');
      }
    }
  }
}

async function pruneStaleBranches(config, branchList) {
  logger.debug('Removing any stale branches');
  logger.trace({ config }, `pruneStaleBranches`);
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  if (!branchList) {
    logger.debug('No branchList');
    return;
  }
  let renovateBranches = await platform.getAllRenovateBranches(
    config.branchPrefix
  );
  if (!(renovateBranches && renovateBranches.length)) {
    logger.debug('No renovate branches found');
    return;
  }
  logger.debug({ branchList, renovateBranches }, 'Branch lists');
  const lockFileBranch = `${config.branchPrefix}lock-file-maintenance`;
  renovateBranches = renovateBranches.filter(
    branch => branch !== lockFileBranch
  );
  const remainingBranches = renovateBranches.filter(
    branch => !branchList.includes(branch)
  );
  logger.debug(`remainingBranches=${remainingBranches}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }

  await cleanUpBranches(config, remainingBranches);
}
