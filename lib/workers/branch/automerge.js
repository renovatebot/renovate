module.exports = {
  tryBranchAutomerge,
};

async function tryBranchAutomerge(config) {
  logger.debug('Checking if we can automerge branch');
  if (!(config.automerge && config.automergeType === 'branch')) {
    return 'no automerge';
  }
  const existingPr = await platform.getBranchPr(config.branchName);

  const branchStatus = await platform.getBranchStatus(
    config.branchName,
    config.requiredStatusChecks
  );

  if (existingPr) {
    if (branchStatus === 'success') {
      if (existingPr.canRebase) {
        await platform.mergeBranch(config.branchName, config.automergeType);
        logger.info({ branch: config.branchName }, 'Branch automerged');
        return 'automerged'; // Branch no longer exists
      }
      return 'automerge aborted - Human commits detected';
    }
    return 'automerge aborted - PR exists';
  }
  if (branchStatus === 'success') {
    logger.debug(`Automerging branch`);
    try {
      await platform.mergeBranch(config.branchName);
      logger.info({ branch: config.branchName }, 'Branch automerged');
      return 'automerged'; // Branch no longer exists
    } catch (err) {
      // istanbul ignore if
      if (err.message === 'not ready') {
        logger.info('Branch is not ready for automerge');
        return 'not ready';
      }
      logger.info({ err }, `Failed to automerge branch`);
      return 'failed';
    }
  } else if (['failure', 'error'].includes(branchStatus)) {
    return 'branch status error';
  } else {
    logger.debug(`Branch status is "${branchStatus}" - skipping automerge`);
  }
  return 'no automerge';
}
