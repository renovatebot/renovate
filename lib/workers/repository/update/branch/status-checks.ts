import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { BranchStatus } from '../../../../types';
import { isActiveConfidenceLevel } from '../../../../util/merge-confidence';
import type { MergeConfidence } from '../../../../util/merge-confidence/types';

export async function resolveBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
  ignoreTests = false
): Promise<BranchStatus> {
  logger.debug(
    `resolveBranchStatus(branchName=${branchName}, ignoreTests=${ignoreTests})`
  );

  if (ignoreTests) {
    logger.debug('Ignore tests. Return green');
    return 'green';
  }

  const status = await platform.getBranchStatus(
    branchName,
    internalChecksAsSuccess
  );
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

export interface AgeConfig extends RenovateConfig {
  ageStatus?: BranchStatus;
  branchName: string;
}

export async function setAge(config: StabilityConfig): Promise<void> {
  if (!config.ageStatus) {
    return;
  }
  const context = `renovate/minimum-release-age`;
  const description =
    config.ageStatus === 'green'
      ? 'Updates have met minimum release age requirement'
      : 'Updates have not met minimum release age requirement';
  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.ageStatus,
    config.productLinks?.documentation
  );
}

export interface ConfidenceConfig extends RenovateConfig {
  confidenceStatus?: BranchStatus;
  minimumConfidence?: MergeConfidence | undefined;
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
