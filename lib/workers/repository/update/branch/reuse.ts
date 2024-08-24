import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import type { RangeStrategy } from '../../../../types';
import type { BranchConfig } from '../../../types';

async function shouldKeepUpdated(
  config: BranchConfig,
  baseBranch: string,
  branchName: string,
): Promise<boolean> {
  const keepUpdatedLabel = config.keepUpdatedLabel;
  if (!keepUpdatedLabel) {
    return false;
  }

  const branchPr = await platform.getBranchPr(
    config.branchName,
    config.baseBranch,
  );

  if (branchPr?.labels?.includes(keepUpdatedLabel)) {
    return true;
  }

  return false;
}

export async function shouldReuseExistingBranch(
  config: BranchConfig,
): Promise<BranchConfig> {
  const { baseBranch, branchName } = config;
  const result: BranchConfig = { ...config, reuseExistingBranch: false };
  // Check if branch exists
  if (!(await scm.branchExists(branchName))) {
    logger.debug(`Branch needs creating`);
    return result;
  }
  logger.debug(`Branch already exists`);
  if (result.rebaseWhen === 'auto') {
    if (result.automerge === true) {
      logger.debug(
        'Converting rebaseWhen=auto to rebaseWhen=behind-base-branch because automerge=true',
      );
      result.rebaseWhen = 'behind-base-branch';
    } else if (await platform.getBranchForceRebase?.(result.baseBranch)) {
      logger.debug(
        'Converting rebaseWhen=auto to rebaseWhen=behind-base-branch because platform is configured to require up-to-date branches',
      );
      result.rebaseWhen = 'behind-base-branch';
    } else if (await shouldKeepUpdated(result, baseBranch, branchName)) {
      logger.debug(
        'Converting rebaseWhen=auto to rebaseWhen=behind-base-branch because keep-updated label is set',
      );
      result.rebaseWhen = 'behind-base-branch';
    }
  }
  if (result.rebaseWhen === 'auto') {
    logger.debug(
      'Converting rebaseWhen=auto to rebaseWhen=conflicted because no rule for converting to rebaseWhen=behind-base-branch applies',
    );
    result.rebaseWhen = 'conflicted';
  }
  if (
    result.rebaseWhen === 'behind-base-branch' ||
    (await shouldKeepUpdated(result, baseBranch, branchName))
  ) {
    if (await scm.isBranchBehindBase(branchName, baseBranch)) {
      logger.debug(`Branch is behind base branch and needs rebasing`);
      // We can rebase the branch only if no PR or PR can be rebased
      if (await scm.isBranchModified(branchName, baseBranch)) {
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
      `Skipping behind base branch check due to rebaseWhen=${result.rebaseWhen!}`,
    );
  }

  // Now check if PR is unmergeable. If so then we also rebase
  result.isConflicted = await scm.isBranchConflicted(baseBranch, branchName);
  if (result.isConflicted) {
    logger.debug('Branch is conflicted');

    if ((await scm.isBranchModified(branchName, baseBranch)) === false) {
      logger.debug(`Branch is not mergeable and needs rebasing`);
      if (
        result.rebaseWhen === 'never' &&
        !(await shouldKeepUpdated(result, baseBranch, branchName))
      ) {
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
  for (const upgrade of result.upgrades) {
    const packageFile = upgrade.packageFile!;
    groupedByPackageFile[packageFile] ??= new Set();
    groupedByPackageFile[packageFile].add(upgrade.rangeStrategy!);

    if (
      groupedByPackageFile[packageFile].size > 1 &&
      groupedByPackageFile[packageFile].has('update-lockfile')
    ) {
      logger.debug(
        `Detected multiple rangeStrategies along with update-lockfile`,
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
