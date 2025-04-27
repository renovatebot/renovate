import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { scm } from '../../../modules/platform/scm';
import { deleteReconfigureBranchCache } from './reconfigure-cache';
import { getReconfigureBranchName } from './utils';
import { validateReconfigureBranch } from './validate';

export async function checkReconfigureBranch(
  config: RenovateConfig,
): Promise<void> {
  logger.debug('checkReconfigureBranch()');
  if (GlobalConfig.get('platform') === 'local') {
    logger.debug(
      'Not attempting to reconfigure when running with local platform',
    );
    return;
  }

  const reconfigureBranch = getReconfigureBranchName(config.branchPrefix!);
  const branchExists = await scm.branchExists(reconfigureBranch);

  // this is something the user initiates, so skip if no branch exists
  if (!branchExists) {
    logger.debug('No reconfigure branch found');
    deleteReconfigureBranchCache(); // in order to remove cache when the branch has been deleted
    return;
  }

  await validateReconfigureBranch(config);
}
