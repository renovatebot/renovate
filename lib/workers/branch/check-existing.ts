import { logger } from '../../logger';
import { platform } from '../../platform';
import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import { BranchConfig } from '../common';

/** TODO: Proper return type */
export async function prAlreadyExisted(
  config: BranchConfig
): Promise<any | null> {
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
    state: '!open',
  });
  if (pr) {
    logger.debug('Found closed PR with current title');
    const prDetails = await platform.getPr(pr.number);
    // istanbul ignore if
    if (prDetails.state === 'open') {
      logger.debug('PR reopened');
      throw new Error(REPOSITORY_CHANGED);
    }
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
