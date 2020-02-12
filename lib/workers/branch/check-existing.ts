import { logger } from '../../logger';
import { RenovateConfig } from '../../config';
import { platform } from '../../platform';
import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import {
  PR_STATE_NOT_OPEN,
  PR_STATE_OPEN,
} from '../../constants/pull-requests';

/** TODO: Proper return type */
export async function prAlreadyExisted(
  config: RenovateConfig
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
    state: PR_STATE_NOT_OPEN,
  });
  if (pr) {
    logger.debug('Found closed PR with current title');
    const prDetails = await platform.getPr(pr.number);
    // istanbul ignore if
    if (prDetails.state === PR_STATE_OPEN) {
      logger.debug('PR reopened');
      throw new Error(REPOSITORY_CHANGED);
    }
    return pr;
  }
  logger.debug('prAlreadyExisted=false');
  return null;
}
