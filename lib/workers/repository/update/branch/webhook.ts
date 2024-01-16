import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';

function runWebhook(config: BranchConfig, branchPr: Pr | null): void {
  if (!branchPr) {
    logger.debug('Could not run webhook. PR object is null.');
    return;
  }

  logger.info(generatePRLink(branchPr.sourceRepo!, branchPr.number));
}

function generatePRLink(sourceRepo: string, prNumber: number): string {
  const platform = GlobalConfig.get('platform');
  const endpoint = GlobalConfig.get('endpoint');

  switch (platform) {
    case 'github':
      return `https://github.com/${sourceRepo}/pull/${prNumber}`;
    case 'gitlab':
      return `${new URL(endpoint!).hostname}/${sourceRepo}/-/merge_requests/${prNumber}`;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export { runWebhook };
