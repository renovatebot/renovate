module.exports = {
  pruneStaleBranches,
};

async function pruneStaleBranches(config) {
  // TODO: try/catch
  const { branchList, logger } = config;
  logger.debug('Removing any stale branches');
  logger.trace({ config }, `pruneStaleBranches`);
  if (!config.branchList) {
    logger.debug('No branchList');
    return;
  }
  if (config.platform !== 'github') {
    // TODO: Implement for GitLab
    logger.debug('Platform is not GitHub - returning');
    return;
  }
  let renovateBranches = await platform.getAllRenovateBranches(
    config.branchPrefix
  );
  logger.debug(`renovateBranches=${renovateBranches}`);
  const lockFileBranch = `${config.branchPrefix}lock-file-maintenance`;
  if (renovateBranches.includes(lockFileBranch)) {
    logger.debug('Checking lock file branch');
    const pr = await platform.getBranchPr(lockFileBranch);
    if (pr && pr.isUnmergeable) {
      logger.info('Deleting lock file maintenance branch as it is unmergeable');
      await platform.deleteBranch(lockFileBranch);
    }
    renovateBranches = renovateBranches.filter(
      branch => branch !== lockFileBranch
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
    const pr = await platform.findPr(branchName, null, 'open');
    if (pr) {
      logger.info({ prNo: pr.number, prTitle: pr.title }, 'Autoclosing PR');
      await platform.updatePr(pr.number, `${pr.title} - autoclosed`);
    }
    await platform.deleteBranch(branchName);
  }
}
