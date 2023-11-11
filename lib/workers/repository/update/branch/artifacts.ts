import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';

export async function setArtifactErrorStatus(
  config: BranchConfig,
): Promise<void> {
  if (!config.artifactErrors?.length) {
    // no errors
    return;
  }

  const context = `renovate/artifacts`;
  const description = 'Artifact file update failure';
  const state = 'red';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context,
  );

  // Check if state needs setting
  if (existingState !== state) {
    logger.debug(`Updating status check state to failed`);
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would set branch status in ' + config.branchName);
    } else {
      await platform.setBranchStatus({
        branchName: config.branchName,
        context,
        description,
        state,
      });
    }
  }
}
