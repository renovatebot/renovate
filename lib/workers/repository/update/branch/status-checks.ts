import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { BranchStatus } from '../../../../types';
import {
  MergeConfidence,
  isActiveConfidenceLevel,
} from '../../../../util/merge-confidence';

export async function resolveBranchStatus(
  branchName: string,
  ignoreTests = false
): Promise<BranchStatus> {
  logger.debug(
    `resolveBranchStatus(branchName=${branchName}, ignoreTests=${ignoreTests})`
  );

  if (ignoreTests) {
    logger.debug('Ignore tests. Return green');
    return 'green';
  }

  const status = await platform.getBranchStatus(branchName);
  logger.debug(`Branch status ${status}`);

  return status;
}

async function setStatusCheck(
  branchName: string,
  context: string,
  description: string,
  state: BranchStatus,
  url?: string
): Promise<void> {
  const existingState = await platform.getBranchStatusCheck(
    branchName,
    context
  );
  if (existingState === state) {
    logger.debug(`Status check ${context} is already up-to-date`);
  } else {
    logger.debug(`Updating ${context} status check state to ${state}`);
    await platform.setBranchStatus({
      branchName,
      context,
      description,
      state,
      url,
    });
  }
}

export interface StabilityConfig extends RenovateConfig {
  stabilityStatus?: BranchStatus;
  branchName: string;
}

export async function setStability(config: StabilityConfig): Promise<void> {
  if (!config.stabilityStatus) {
    return;
  }
  const context = `renovate/stability-days`;
  const description =
    config.stabilityStatus === 'green'
      ? 'Updates have met stability days requirement'
      : 'Updates have not met stability days requirement';
  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.stabilityStatus,
    config.productLinks?.documentation
  );
}

export interface ConfidenceConfig extends RenovateConfig {
  confidenceStatus?: BranchStatus;
  minimumConfidence?: MergeConfidence;
}

export async function setConfidence(config: ConfidenceConfig): Promise<void> {
  if (
    !config.branchName ||
    !config.confidenceStatus ||
    (config.minimumConfidence &&
      !isActiveConfidenceLevel(config.minimumConfidence))
  ) {
    return;
  }
  const context = `renovate/merge-confidence`;
  const description =
    config.confidenceStatus === 'green'
      ? 'Updates have met Merge Confidence requirement'
      : 'Updates have not met Merge Confidence requirement';
  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.confidenceStatus,
    config.productLinks?.documentation
  );
}
