module.exports = {
  tryBranchAutomerge,
};

async function tryBranchAutomerge(config) {
  const { logger } = config;
  logger.debug('Checking if we can automerge branch');
  if (!config.automerge || config.automergeType === 'pr') {
    return false;
  }
  const branchStatus = await config.api.getBranchStatus(
    config.branchName,
    config.requiredStatusChecks
  );
  if (branchStatus === 'success') {
    logger.info(`Automerging branch`);
    try {
      await config.api.mergeBranch(config.branchName, config.automergeType);
      return true; // Branch no longer exists
    } catch (err) {
      logger.error({ err }, `Failed to automerge branch`);
    }
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  return false;
}
