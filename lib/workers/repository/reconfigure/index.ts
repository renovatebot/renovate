import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { deleteReconfigureBranchCache } from './reconfigure-cache';
import { getReconfigureBranchName } from './utils';
import { validateReconfigureBranch } from './validate';

/**
 * In a reconfigure branch:
 * first check if such a branch exists (no->return)
 * yes:
 * check sha and only continue if sha doesn't match cached sha
 * check if it has a valid config file (no failing check? and return)
 * get the content, validate and give passing check as per it
 *
 * extractDeps
 * ensure pr
 */

export async function checkReconfigureBranch(
  config: RenovateConfig,
): Promise<void> {
  logger.debug('checkReconfigureBranch()');
  if (GlobalConfig.get('platform') === 'local') {
    logger.debug(
      'Not attempting to check reconfigure branch when running with local platform',
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

  // check for the pr if it exists before hand so we do not need to make 2 calls
  const reconfigurePr = await platform.findPr({
    branchName: reconfigureBranch,
    state: 'open',
    includeOtherAuthors: true,
  });
  const { status } = await validateReconfigureBranch(config, reconfigurePr);

  // config is invalid someway
  if (!status) {
    logger.debug('Config is invalid skipping Pr creation');
  }

  // if status is true it mean 4 things
  // 1. config file present
  // 2. it has a valid config file name
  // 3. it has valid json in its
  // 4. the config in it is valid

  // now we need to check if a pr is present or not
  // and if it is then, see if we can update anything in it.
  // first test how an onboarding pr looks like and the info in it
  // can be done by test run a repo or we can check the code
  // remaining query is whether: the vaidate reconfigure branch needs to be refactored further?
  // how the cache will be handled
  // what happens if sha is same? > nothing cause we do not lookup so no sha change do nothing: unless a or is missing do created that
}
