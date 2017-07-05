module.exports = {
  pruneStaleBranches,
};

async function pruneStaleBranches(config, branchUpgradeNames) {
  const logger = config.logger;
  logger.debug('Removing any stale branches');
  logger.trace(
    { config },
    `pruneStaleBranches:\n${JSON.stringify(branchUpgradeNames)}`
  );
  if (config.platform !== 'github') {
    logger.debug('Platform is not GitHub - returning');
    return;
  }
  if (branchUpgradeNames.length === 0) {
    logger.debug('No branchUpgradeNames - returning');
    return;
  }
  const renovateBranches = await config.api.getAllRenovateBranches();
  logger.debug(`renovateBranches=${renovateBranches}`);
  const remainingBranches = renovateBranches.filter(
    branch => branchUpgradeNames.indexOf(branch) === -1
  );
  logger.debug(`remainingBranches=${remainingBranches}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }
  const allPrs = await config.api.getAllPrs();
  for (const branchName of remainingBranches) {
    logger.debug({ branch: branchName }, `Checking orphan branch for deletion`);
    // Default to deleting the branch if we don't find a PR
    let deleteBranch = true;
    let foundPr = false;
    for (const pr of allPrs) {
      if (pr.state === 'open' && pr.branchName === branchName) {
        // We have a matching PR
        foundPr = true;
        logger.debug({ branch: branchName }, `Found matching PR#${pr.number}`);
        const prDetails = config.api.getPr(pr.number);
        if (prDetails.mergeable) {
          // Don't delete the branch if we found a mergeable PR
          logger.debug(
            { branch: branchName },
            'PR is mergeable, so do not delete'
          );
          deleteBranch = false;
        } else {
          logger.debug(
            { branch: branchName },
            'PR is not mergeable, we will delete'
          );
        }
      }
    }
    if (deleteBranch) {
      if (!foundPr) {
        logger.debug({ branch: branchName }, 'Orphan branch has no PR');
      }
      logger.info({ branch: branchName }, `Deleting orphan branch`);
      await config.api.deleteBranch(branchName);
    }
  }
}
