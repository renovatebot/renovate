import { logger } from '../../logger';
import { RenovateConfig } from '../../config';
import { platform } from '../../platform';

async function setStatusCheck(
  branchName: string,
  context: string,
  description: string,
  state: string,
  url: string
): Promise<void> {
  const existingState = await platform.getBranchStatusCheck(
    branchName,
    context
  );
  // Check if state needs setting
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

export type StabilityConfig = RenovateConfig & {
  stabilityStatus?: string;
  branchName: string;
};

export async function setStability(config: StabilityConfig): Promise<void> {
  if (!config.stabilityStatus) {
    return;
  }
  const context = `renovate/stability-days`;
  const description =
    config.stabilityStatus === 'success'
      ? 'Updates have met stability days requirement'
      : 'Updates have not met stability days requirement';
  await setStatusCheck(
    config.branchName,
    context,
    description,
    config.stabilityStatus,
    config.productLinks.documentation
  );
}

export type UnpublishableConfig = RenovateConfig & {
  unpublishSafe?: boolean;
  canBeUnpublished?: boolean;
  branchName: string;
};

export async function setUnpublishable(
  config: UnpublishableConfig
): Promise<void> {
  if (!config.unpublishSafe) {
    return;
  }
  const context = `renovate/unpublish-safe`;
  // Set canBeUnpublished status check
  const state = config.canBeUnpublished ? 'pending' : 'success';
  const description = config.canBeUnpublished
    ? 'Packages < 24 hours old can be unpublished'
    : 'Packages cannot be unpublished';
  await setStatusCheck(
    config.branchName,
    context,
    description,
    state,
    config.productLinks.docs
  );
}
