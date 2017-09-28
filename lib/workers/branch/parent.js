module.exports = {
  checkStale,
  getParentBranch,
};

function checkStale(config) {
  return (
    config.rebaseStalePrs ||
    config.repoForceRebase ||
    (config.automerge === true && config.automergeType === 'branch-push')
  );
}

async function getParentBranch(config) {
  const { api, branchName, logger } = config;
  // Check if branch exists
  const branchExists = await api.branchExists(branchName);
  if (!branchExists) {
    logger.info(`Branch needs creating`);
    return undefined;
  }
  logger.info(`Branch already exists`);

  // Check for existing PR
  const pr = await api.getBranchPr(branchName);

  if (
    config.rebaseStalePrs ||
    config.repoForceRebase ||
    (config.automerge && config.automergeType === 'branch-push')
  ) {
    const isBranchStale = await api.isBranchStale(branchName);
    if (isBranchStale) {
      logger.info(`Branch is stale and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (!pr || pr.canRebase) {
        return undefined;
      }
      // TODO: Warn here so that it appears in PR body
      logger.info('Cannot rebase branch');
      return branchName;
    }
  }

  // Now check if PR is unmergeable. If so then we also rebase
  if (pr && pr.isUnmergeable) {
    logger.debug('PR is unmergeable');
    if (pr.canRebase) {
      logger.info(`Branch is not mergeable and needs rebasing`);
      // TODO: Move this down to api library
      if (config.isGitLab) {
        logger.info(`Deleting unmergeable branch in order to recreate/rebase`);
        await config.api.deleteBranch(branchName);
      }
      // Setting parentBranch back to undefined means that we'll use the default branch
      return undefined;
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR
    logger.info(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return branchName;
}
