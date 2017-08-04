module.exports = {
  pruneStaleBranches,
};

async function pruneStaleBranches(config, branchList) {
  const logger = config.logger;
  logger.debug('Removing any stale branches');
  logger.trace({ config, branchList }, `pruneStaleBranches`);
  if (config.platform !== 'github') {
    logger.debug('Platform is not GitHub - returning');
    return;
  }
  let renovateBranches = await config.api.getAllRenovateBranches(
    config.branchPrefix
  );
  logger.debug(`renovateBranches=${renovateBranches}`);
  if (
    renovateBranches.indexOf(`${config.branchPrefix}lock-file-maintenance`) !== -1
  ) {
    logger.debug('Checking lock file branch');
    const pr = await config.api.getBranchPr(
      `${config.branchPrefix}lock-file-maintenance`
    );
    if (pr && pr.isClosed) {
      logger.info(
        'Deleting lock file maintenance branch as PR has been closed'
      );
      await config.api.deleteBranch(
        `${config.branchPrefix}lock-file-maintenance`
      );
    } else if (pr && pr.isUnmergeable) {
      logger.info('Deleting lock file maintenance branch as it is unmergeable');
      await config.api.deleteBranch(
        `${config.branchPrefix}lock-file-maintenance`
      );
    } else if (pr && pr.changed_files === 0) {
      logger.info(
        'Deleting lock file maintenance branch as it has no changed files'
      );
      await config.api.deleteBranch(
        `${config.branchPrefix}lock-file-maintenance`
      );
    }
    renovateBranches = renovateBranches.filter(
      branch => branch !== `${config.branchPrefix}lock-file-maintenance`
    );
  }
  const remainingBranches = renovateBranches.filter(
    branch => branchList.indexOf(branch) === -1
  );
  logger.debug(`remainingBranches=${remainingBranches}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }
  for (const branchName of remainingBranches) {
    logger.debug({ branch: branchName }, `Deleting orphan branch`);
    await config.api.deleteBranch(branchName);
  }
}
