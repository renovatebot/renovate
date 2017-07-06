module.exports = {
  pruneStaleBranches,
};

async function pruneStaleBranches(config, branchList) {
  const logger = config.logger;
  logger.debug('Removing any stale branches');
  logger.trace(
    { config },
    `pruneStaleBranches:\n${JSON.stringify(branchList)}`
  );
  if (config.platform !== 'github') {
    logger.debug('Platform is not GitHub - returning');
    return;
  }
  const renovateBranches = await config.api.getAllRenovateBranches();
  logger.debug(`renovateBranches=${renovateBranches}`);
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
