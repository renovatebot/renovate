// TODO #7154
import { REPOSITORY_CHANGED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';

export async function prAlreadyExisted(
  config: BranchConfig
): Promise<Pr | null> {
  logger.trace({ config }, 'prAlreadyExisted');
  if (config.recreateClosed) {
    logger.debug('recreateClosed is true');
    return null;
  }
  logger.debug('recreateClosed is false');
  // Return if same PR already existed
  let pr = await platform.findPr({
    branchName: config.branchName,
    prTitle: config.prTitle,
    state: '!open',
  });

  if (!pr && config.branchPrefix !== config.branchPrefixOld) {
    pr = await platform.findPr({
      branchName: config.branchName.replace(
        config.branchPrefix!,
        config.branchPrefixOld!
      ),
      prTitle: config.prTitle,
      state: '!open',
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
