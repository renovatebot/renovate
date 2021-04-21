import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { platform } from '../../platform';
import { BranchStatus } from '../../types';

async function setStatusCheck(
  branchName: string,
  context: string,
  description: string,
  state: BranchStatus,
  url: string
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

export type StabilityConfig = RenovateConfig & {
  stabilityStatus?: BranchStatus;
  branchName: string;
};

export async function setStability(config: StabilityConfig): Promise<void> {
  if (!config.stabilityStatus) {
    return;
  }
  const context = `renovate/stability-days`;
  const description =
    config.stabilityStatus === BranchStatus.green
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
