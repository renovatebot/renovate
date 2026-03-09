import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import type { BranchConfig } from '../../../types.ts';

export async function setArtifactErrorStatus(
  config: BranchConfig,
): Promise<void> {
  if (!config.artifactErrors?.length) {
    // no errors
    return;
  }

  const context = config.statusCheckNames?.artifactError;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

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
