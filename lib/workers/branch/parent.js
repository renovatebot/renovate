module.exports = {
  getParentBranch,
};

async function getParentBranch(config) {
  const { branchName } = config;
  // Check if branch exists
  const branchExists = await platform.branchExists(branchName);
  if (!branchExists) {
    logger.info(`Branch needs creating`);
    return { parentBranch: undefined };
  }
  logger.info(`Branch already exists`);

  // Check for existing PR
  const pr = await platform.getBranchPr(branchName);

  if (
    config.rebaseStalePrs ||
    (await platform.getRepoForceRebase()) ||
    (config.automerge && config.automergeType === 'branch-push')
  ) {
    const isBranchStale = await platform.isBranchStale(branchName);
    if (isBranchStale) {
      logger.info(`Branch is stale and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (!pr || pr.canRebase) {
        return { parentBranch: undefined };
      }
      // TODO: Warn here so that it appears in PR body
      logger.info('Cannot rebase branch');
      return { parentBranch: branchName, canRebase: false };
    }
  }

  // Now check if PR is unmergeable. If so then we also rebase
  if (pr && pr.isUnmergeable) {
    logger.debug('PR is unmergeable');
    if (pr.canRebase) {
      logger.info(`Branch is not mergeable and needs rebasing`);
      // TODO: Move this down to api library
      if (config.isGitLab || config.isVsts) {
        logger.info(`Deleting unmergeable branch in order to recreate/rebase`);
        await platform.deleteBranch(branchName);
      }
      // Setting parentBranch back to undefined means that we'll use the default branch
      return { parentBranch: undefined };
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR
    logger.info(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return { parentBranch: branchName, canRebase: true };
}
