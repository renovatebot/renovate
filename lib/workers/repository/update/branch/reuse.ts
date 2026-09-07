import { logger } from '../../../../logger/index.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import type { RangeStrategy } from '../../../../types/index.ts';
import type { BranchConfig } from '../../../types.ts';

/**
 * What should happen to an existing branch:
 *
 * - `no-reuse`: the branch must be recreated from the base branch
 * - `unchanged`: leave `reuseExistingBranch` at its configured value
 * - `check-reuse`: let `shouldReuseExistingBranch()` decide
 * - `skip-update`: the branch must not be updated at all
 */
export type BranchReuseAction =
  | 'no-reuse'
  | 'unchanged'
  | 'check-reuse'
  | 'skip-update';

export interface BranchReuseDecision {
  action: BranchReuseAction;
  userRebaseRequested: boolean;
}

export interface BranchReuseDecisionInput {
  config: BranchConfig;
  branchPr: Pr | null;
  branchExists: boolean;
  dependencyDashboardCheck: string | undefined;
  forceRebase: boolean;
}

/**
 * Decides whether an existing branch may be reused, based on the user's
 * requests and the branch's configuration alone. Anything which needs to
 * inspect the branch itself is left to `shouldReuseExistingBranch()`.
 */
export function decideBranchReuse({
  config,
  branchPr,
  branchExists,
  dependencyDashboardCheck,
  forceRebase,
}: BranchReuseDecisionInput): BranchReuseDecision {
  const userRebaseRequested =
    dependencyDashboardCheck === 'rebase' ||
    !!config.dependencyDashboardRebaseAllOpen ||
    !!config.rebaseRequested;

  if (forceRebase) {
    logger.debug('Force rebase because branch needs updating');
    return { action: 'no-reuse', userRebaseRequested };
  }

  if (userRebaseRequested) {
    logger.debug('User has requested rebase');
    return { action: 'no-reuse', userRebaseRequested };
  }

  if (dependencyDashboardCheck === 'global-config') {
    logger.debug(`Manual create/rebase requested via checkedBranches`);
    return { action: 'no-reuse', userRebaseRequested: true };
  }

  if (config.dependencyDashboardAllPending) {
    logger.debug(
      'A user manually approved all pending PRs via the Dependency Dashboard.',
    );
    return { action: 'unchanged', userRebaseRequested };
  }

  if (config.dependencyDashboardAllRateLimited) {
    logger.debug(
      'A user manually approved all rate-limited PRs via the Dependency Dashboard.',
    );
    return { action: 'unchanged', userRebaseRequested };
  }

  if (config.dependencyDashboardAllAwaitingSchedule) {
    logger.debug(
      'A user manually requested all awaiting schedule PRs via the Dependency Dashboard.',
    );
    return { action: 'unchanged', userRebaseRequested };
  }

  const keepUpdatedLabel = config.keepUpdatedLabel;
  if (
    branchExists &&
    config.rebaseWhen === 'never' &&
    !(keepUpdatedLabel && branchPr?.labels?.includes(keepUpdatedLabel)) &&
    !dependencyDashboardCheck
  ) {
    logger.debug('rebaseWhen=never so skipping branch update check');
    return { action: 'skip-update', userRebaseRequested };
  }

  // if the base branch has been changed by user in renovate config, rebase onto the new baseBranch
  // we have already confirmed earlier that branch isn't modified, so its safe to use targetBranch here
  if (branchPr?.targetBranch && branchPr.targetBranch !== config.baseBranch) {
    logger.debug(
      'Base branch changed by user, rebasing the branch onto new base',
    );
    return { action: 'no-reuse', userRebaseRequested };
  }

  if (config.cacheFingerprintMatch === 'no-match') {
    logger.debug(
      'Cache fingerprint does not match, cannot reuse existing branch',
    );
    return { action: 'no-reuse', userRebaseRequested };
  }

  return { action: 'check-reuse', userRebaseRequested };
}

async function shouldKeepUpdated(
  config: BranchConfig,
  _baseBranch: string,
  _branchName: string,
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

  const keepUpdated = await shouldKeepUpdated(result, baseBranch, branchName);
  await determineRebaseWhenValue(result, keepUpdated);

  // Check if branch exists
  if (!(await scm.branchExists(branchName))) {
    logger.debug(`Branch needs creating`);
    return result;
  }
  logger.debug(`Branch already exists`);

  if (result.rebaseWhen === 'behind-base-branch' || keepUpdated) {
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
      if (result.rebaseWhen === 'never' && !keepUpdated) {
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

/**
 * This method updates rebaseWhen value when it's set to auto(default) or automerging
 *
 * @param result BranchConfig
 * @param keepUpdated boolean
 */
async function determineRebaseWhenValue(
  result: BranchConfig,
  keepUpdated: boolean,
): Promise<void> {
  if (result.rebaseWhen === 'auto' || result.rebaseWhen === 'automerging') {
    let reason;
    let newValue = 'behind-base-branch';
    if (result.automerge === true) {
      reason = 'automerge=true';
    } else if (keepUpdated) {
      reason = 'keep-updated label is set';
    } else if (result.rebaseWhen === 'automerging') {
      newValue = 'never';
      reason = 'no keep-updated label and automerging is set';
    } else if (await platform.getBranchForceRebase?.(result.baseBranch)) {
      reason = 'platform is configured to require up-to-date branches';
    } else {
      newValue = 'conflicted';
      reason = 'no rule for behind-base-branch applies';
    }

    logger.debug(
      `Converting rebaseWhen=${result.rebaseWhen} to rebaseWhen=${newValue} because ${reason}`,
    );
    result.rebaseWhen = newValue;
  }
}
