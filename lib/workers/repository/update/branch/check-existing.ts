// TODO #22198
import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { REPOSITORY_CHANGED } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import type { BranchConfig } from '../../../types.ts';

export async function prAlreadyExisted(
  config: BranchConfig,
): Promise<Pr | null> {
  logger.trace({ config }, 'prAlreadyExisted');
  if (config.recreateClosed) {
    logger.debug('recreateClosed is true. No need to check for closed PR.');
    return null;
  }
  logger.debug(
    'Check for closed PR because recreating closed PRs is disabled.',
  );
  // Return if same PR already existed
  let pr = await platform.findPr({
    branchName: config.branchName,
    prTitle: config.prTitle,
    state: '!open',
    targetBranch: config.baseBranch,
  });

  if (!pr && config.branchPrefix !== config.branchPrefixOld) {
    pr = await platform.findPr({
      branchName: config.branchName.replace(
        config.branchPrefix!,
        config.branchPrefixOld!,
      ),
      prTitle: config.prTitle,
      state: '!open',
      targetBranch: config.baseBranch,
    });
    if (pr) {
      logger.debug('Found closed PR with branchPrefixOld');
    }
  }

  if (pr) {
    logger.debug('Found closed PR with current title');
    const prDetails = await platform.getPr(pr.number);
    // istanbul ignore if
    if (prDetails!.state === 'open') {
      logger.debug('PR reopened - aborting run');
      throw new Error(REPOSITORY_CHANGED);
    }
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}

/**
 * Checks whether the user requested a rebase of the branch, either via the PR
 * title, a PR label or the rebase checkbox in the PR body.
 */
export async function rebaseCheck(
  config: RenovateConfig,
  branchPr: Pr,
): Promise<boolean> {
  const titleRebase = branchPr.title?.startsWith('rebase!');
  if (titleRebase) {
    logger.debug(
      `Manual rebase requested via PR title for #${branchPr.number}`,
    );
    return true;
  }
  const labelRebase = !!branchPr.labels?.includes(config.rebaseLabel!);
  if (labelRebase) {
    logger.debug(
      `Manual rebase requested via PR labels for #${branchPr.number}`,
    );
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would delete label ${config.rebaseLabel!} from #${
          branchPr.number
        }`,
      );
    } else {
      await platform.deleteLabel(branchPr.number, config.rebaseLabel!);
    }
    return true;
  }
  const prRebaseChecked = !!branchPr.bodyStruct?.rebaseRequested;
  if (prRebaseChecked) {
    logger.debug(
      `Manual rebase requested via PR checkbox for #${branchPr.number}`,
    );
    return true;
  }

  return false;
}

export function userChangedTargetBranch(pr: Pr): boolean {
  const oldTargetBranch = pr.bodyStruct?.debugData?.targetBranch;
  if (oldTargetBranch && pr.targetBranch) {
    return pr.targetBranch !== oldTargetBranch;
  }
  return false;
}
