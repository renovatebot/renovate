import { logger } from '../../logger';
import { RenovateConfig } from '../../config';
import { platform } from '../../platform';

type ParentBranch = { parentBranch: string | undefined; isModified?: boolean };

export async function getParentBranch(
  config: RenovateConfig
): Promise<ParentBranch> {
  const { branchName } = config;
  // Check if branch exists
  const branchExists = await platform.branchExists(branchName);
  if (!branchExists) {
    logger.info(`Branch needs creating`);
    return { parentBranch: undefined };
  }
  logger.debug(`Branch already exists`);

  // Check for existing PR
  const pr = await platform.getBranchPr(branchName);

  if (pr) {
    if (pr.title && pr.title.startsWith('rebase!')) {
      logger.info('Manual rebase requested via PR title for #' + pr.number);
      return { parentBranch: undefined };
    }
    if (pr.body && pr.body.includes(`- [x] <!-- rebase-check -->`)) {
      logger.info('Manual rebase requested via PR checkbox for #' + pr.number);
      return { parentBranch: undefined };
    }
    if (pr.labels && pr.labels.includes(config.rebaseLabel)) {
      logger.info('Manual rebase requested via PR labels for #' + pr.number);
      // istanbul ignore if
      if (config.dryRun) {
        logger.info(
          `DRY-RUN: Would delete label ${config.rebaseLabel} from #${pr.number}`
        );
      } else {
        await platform.deleteLabel(pr.number, config.rebaseLabel);
      }
      return { parentBranch: undefined };
    }
  }

  if (
    config.rebaseStalePrs ||
    (config.rebaseStalePrs === null && (await platform.getRepoForceRebase())) ||
    (config.automerge && config.automergeType === 'branch')
  ) {
    const isBranchStale = await platform.isBranchStale(branchName);
    if (isBranchStale) {
      logger.info(`Branch is stale and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (!pr || !pr.isModified) {
        return { parentBranch: undefined };
      }
      // TODO: Warn here so that it appears in PR body
      logger.info('Cannot rebase branch');
      return { parentBranch: branchName, isModified: true };
    }
  }

  // Now check if PR is unmergeable. If so then we also rebase
  if (pr && pr.isConflicted) {
    logger.debug('PR is conflicted');

    if (!pr.isModified) {
      logger.info(`Branch is not mergeable and needs rebasing`);
      if (!config.rebaseConflictedPrs) {
        logger.info('rebaseConflictedPrs is disabled');
        return { parentBranch: branchName, isModified: false };
      }
      // Setting parentBranch back to undefined means that we'll use the default branch
      return { parentBranch: undefined };
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR
    logger.info(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return { parentBranch: branchName, isModified: false };
}
