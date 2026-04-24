import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import type { BranchConfig } from '../../../types.ts';

export async function setArtifactErrorStatus(
  config: BranchConfig,
): Promise<void> {
  const mode = config.artifactsCheckWhen ?? 'failed';

  if (mode === 'never') {
    logger.debug(
      'artifactsCheckWhen is set to "never", skipping artifacts status check.',
    );
    return;
  }

  const hasErrors = !!config.artifactErrors?.length;

  if (mode === 'failed' && !hasErrors) {
    // default behavior: only set status when there are errors
    return;
  }

  const context = config.statusCheckNames?.artifactError;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

  const state = hasErrors ? 'red' : 'green';
  const description = hasErrors
    ? 'Artifact file update failure'
    : 'Artifact file update success';
  const existingState = await platform.getBranchStatusCheck(
    config.branchName,
    context,
  );

  // Check if state needs setting
  if (existingState !== state) {
    logger.debug(`Updating status check state to ${state}`);
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
