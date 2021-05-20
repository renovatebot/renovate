import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { Pr, platform } from '../../platform';
import { PrState } from '../../types';
import type { BranchConfig } from '../types';

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
  const pr = await platform.findPr({
    branchName: config.branchName,
    prTitle: config.prTitle,
    state: PrState.NotOpen,
  });
  if (pr) {
    logger.debug('Found closed PR with current title');
    const prDetails = await platform.getPr(pr.number);
    // istanbul ignore if
    if (prDetails.state === PrState.Open) {
      logger.debug('PR reopened - aborting run');
      throw new Error(REPOSITORY_CHANGED);
    }
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
