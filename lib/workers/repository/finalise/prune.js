module.exports = {
  pruneStaleBranches,
};

async function cleanUpBranches(remainingBranches) {
  for (const branchName of remainingBranches) {
    try {
      const pr = await platform.findPr(branchName, null, 'open');
      if (pr) {
        if (!pr.title.endsWith('- autoclosed')) {
          await platform.updatePr(pr.number, `${pr.title} - autoclosed`);
        }
      }
      const closePr = true;
      logger.info({ branch: branchName }, `Deleting orphan branch`);
      await platform.deleteBranch(branchName, closePr);
      if (pr) {
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

  await cleanUpBranches(remainingBranches);
}
