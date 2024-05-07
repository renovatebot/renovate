import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { BranchStatus } from '../../../../types';
import { isActiveConfidenceLevel } from '../../../../util/merge-confidence';
import type { MergeConfidence } from '../../../../util/merge-confidence/types';
import { coerceString } from '../../../../util/string';
import { joinUrlParts } from '../../../../util/url';

export async function resolveBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
  ignoreTests = false,
): Promise<BranchStatus> {
  logger.debug(
    `resolveBranchStatus(branchName=${branchName}, ignoreTests=${ignoreTests})`,
  );

  if (ignoreTests) {
    logger.debug('Ignore tests. Return green');
    return 'green';
  }

  const status = await platform.getBranchStatus(
    branchName,
    internalChecksAsSuccess,
  );
  logger.debug(`Branch status ${status}`);

  return status;
}

async function setStatusCheck(
  branchName: string,
  context: string,
  description: string,
  state: BranchStatus,
  url?: string,
): Promise<void> {
  const existingState = await platform.getBranchStatusCheck(
    branchName,
    context,
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

  const context = config.statusCheckNames?.minimumReleaseAge;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

  const description =
    config.stabilityStatus === 'green'
      ? 'Updates have met minimum release age requirement'
      : 'Updates have not met minimum release age requirement';

  const docsLink = joinUrlParts(
    coerceString(config.productLinks?.documentation),
    'configuration-options/#minimumreleaseage',
  );

  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.stabilityStatus,
    docsLink,
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
  const context = config.statusCheckNames?.mergeConfidence;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

  const description =
    config.confidenceStatus === 'green'
      ? 'Updates have met Merge Confidence requirement'
      : 'Updates have not met Merge Confidence requirement';

  const docsLink = joinUrlParts(
    coerceString(config.productLinks?.documentation),
    'merge-confidence',
  );

  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.confidenceStatus,
    docsLink,
  );
}
