// TODO #22198
import { REPOSITORY_CHANGED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';

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
