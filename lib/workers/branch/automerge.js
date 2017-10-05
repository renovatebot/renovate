module.exports = {
  tryBranchAutomerge,
};

async function tryBranchAutomerge(config) {
  const { logger } = config;
  logger.debug('Checking if we can automerge branch');
  if (!config.automerge || config.automergeType === 'pr') {
    return 'no automerge';
  }
  const branchStatus = await config.api.getBranchStatus(
    config.branchName,
    config.requiredStatusChecks
  );
  if (branchStatus === 'success') {
    logger.info(`Automerging branch`);
    try {
      await config.api.mergeBranch(config.branchName, config.automergeType);
      return 'automerged'; // Branch no longer exists
    } catch (err) {
      logger.info({ err }, `Failed to automerge branch`);
      return 'failed';
    }
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  return 'no automerge';
}
