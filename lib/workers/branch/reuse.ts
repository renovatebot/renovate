import { getAdminConfig } from '../../config/admin';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { platform } from '../../platform';
import { branchExists, isBranchModified, isBranchStale } from '../../util/git';

type ParentBranch = {
  reuseExistingBranch: boolean;
  isModified?: boolean;
};

export async function shouldReuseExistingBranch(
  config: RenovateConfig
): Promise<ParentBranch> {
  const { branchName } = config;
  // Check if branch exists
  if (!branchExists(branchName)) {
    logger.debug(`Branch needs creating`);
    return { reuseExistingBranch: false };
  }
  logger.debug(`Branch already exists`);

  // Check for existing PR
  const pr = await platform.getBranchPr(branchName);

  if (pr) {
    if (pr.title?.startsWith('rebase!')) {
      logger.debug(`Manual rebase requested via PR title for #${pr.number}`);
      return { reuseExistingBranch: false };
    }
    if (pr.body?.includes(`- [x] <!-- rebase-check -->`)) {
      logger.debug(`Manual rebase requested via PR checkbox for #${pr.number}`);
      return { reuseExistingBranch: false };
    }
    if (pr.labels?.includes(config.rebaseLabel)) {
      logger.debug(`Manual rebase requested via PR labels for #${pr.number}`);
      // istanbul ignore if
      if (getAdminConfig().dryRun) {
        logger.info(
          `DRY-RUN: Would delete label ${config.rebaseLabel} from #${pr.number}`
        );
      } else {
        await platform.deleteLabel(pr.number, config.rebaseLabel);
      }
      return { reuseExistingBranch: false };
    }
  }

  if (
    config.rebaseWhen === 'behind-base-branch' ||
    (config.rebaseWhen === 'auto' &&
      (config.automerge || (await platform.getRepoForceRebase())))
  ) {
    if (await isBranchStale(branchName)) {
      logger.debug(`Branch is stale and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (await isBranchModified(branchName)) {
        // TODO: Warn here so that it appears in PR body
        logger.debug('Cannot rebase branch as it has been modified');
        return { reuseExistingBranch: true, isModified: true };
      }
      return { reuseExistingBranch: false };
    }
    logger.debug('Branch is up-to-date');
  } else {
    logger.debug(
      `Skipping stale branch check due to rebaseWhen=${config.rebaseWhen}`
    );
  }

  // Now check if PR is unmergeable. If so then we also rebase
  if (pr?.isConflicted) {
    logger.debug('PR is conflicted');

    if ((await isBranchModified(branchName)) === false) {
      logger.debug(`Branch is not mergeable and needs rebasing`);
      if (config.rebaseWhen === 'never') {
        logger.debug('Rebasing disabled by config');
        return { reuseExistingBranch: true, isModified: false };
      }
      // Setting reuseExistingBranch back to undefined means that we'll use the default branch
      return { reuseExistingBranch: false };
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR
    logger.debug(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);
  return { reuseExistingBranch: true, isModified: false };
}
