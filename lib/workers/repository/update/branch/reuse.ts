// TODO #7154
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { RangeStrategy } from '../../../../types';
import {
  branchExists,
  isBranchBehindBase,
  isBranchConflicted,
  isBranchModified,
} from '../../../../util/git';
import type { BranchConfig } from '../../../types';

type ParentBranch = {
  reuseExistingBranch: boolean;
  isModified?: boolean;
  isConflicted?: boolean;
};

export async function shouldReuseExistingBranch(
  config: BranchConfig
): Promise<ParentBranch> {
  const { baseBranch, branchName } = config;
  const result: ParentBranch = { reuseExistingBranch: false };
  // Check if branch exists
  if (!branchExists(branchName)) {
    logger.debug(`Branch needs creating`);
    return result;
  }
  logger.debug(`Branch already exists`);

  // Check for existing PR
  const pr = await platform.getBranchPr(branchName);

  if (pr) {
    if (pr.title?.startsWith('rebase!')) {
      logger.debug(`Manual rebase requested via PR title for #${pr.number}`);
      return result;
    }
    if (pr.bodyStruct?.rebaseRequested) {
      logger.debug(`Manual rebase requested via PR checkbox for #${pr.number}`);
      return result;
    }
    if (pr.labels?.includes(config.rebaseLabel!)) {
      logger.debug(`Manual rebase requested via PR labels for #${pr.number}`);
      // istanbul ignore if
      if (GlobalConfig.get('dryRun')) {
        logger.info(
          `DRY-RUN: Would delete label ${config.rebaseLabel!} from #${
            pr.number
          }`
        );
      } else {
        await platform.deleteLabel(pr.number, config.rebaseLabel!);
      }
      return result;
    }
  }

  if (
    config.rebaseWhen === 'behind-base-branch' ||
    (config.rebaseWhen === 'auto' &&
      (config.automerge || (await platform.getRepoForceRebase())))
  ) {
    if (await isBranchBehindBase(branchName)) {
      logger.debug(`Branch is behind base branch and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (await isBranchModified(branchName)) {
        logger.debug('Cannot rebase branch as it has been modified');
        result.reuseExistingBranch = true;
        result.isModified = true;
        return result;
      }
      logger.debug('Branch is unmodified, so can be rebased');
      return result;
    }
    logger.debug('Branch is up-to-date');
  } else {
    logger.debug(
      `Skipping behind base branch check due to rebaseWhen=${config.rebaseWhen!}`
    );
  }

  // Now check if PR is unmergeable. If so then we also rebase
  result.isConflicted = await isBranchConflicted(baseBranch!, branchName);
  if (result.isConflicted) {
    logger.debug('Branch is conflicted');

    if ((await isBranchModified(branchName)) === false) {
      logger.debug(`Branch is not mergeable and needs rebasing`);
      if (config.rebaseWhen === 'never') {
        logger.debug('Rebasing disabled by config');
        result.reuseExistingBranch = true;
        result.isModified = false;
      }
      // Setting reuseExistingBranch back to undefined means that we'll use the default branch
      return result;
    }
    // Don't do anything different, but warn
    // TODO: Add warning to PR (#9720)
    logger.debug(`Branch is not mergeable but can't be rebased`);
  }
  logger.debug(`Branch does not need rebasing`);

  // Branches can get in an inconsistent state if "update-lockfile" is used at the same time as other strategies
  // On the first execution, everything is executed, but if on a second execution the package.json modification is
  // skipped but the lockfile update is executed, the lockfile will have a different result than if it was executed
  // along with the changes to the package.json. Thus ending up with an incomplete branch update
  // This is why we are skipping branch reuse in this case (#10050)
  const groupedByPackageFile: Record<string, Set<RangeStrategy>> = {};
  for (const upgrade of config.upgrades) {
    const packageFile = upgrade.packageFile!;
    groupedByPackageFile[packageFile] ??= new Set();
    groupedByPackageFile[packageFile].add(upgrade.rangeStrategy!);

    if (
      groupedByPackageFile[packageFile].size > 1 &&
      groupedByPackageFile[packageFile].has('update-lockfile')
    ) {
      logger.debug(
        `Detected multiple rangeStrategies along with update-lockfile`
      );
      result.reuseExistingBranch = false;
      result.isModified = false;
      return result;
    }
  }

  result.reuseExistingBranch = true;
  result.isModified = false;
  return result;
}
