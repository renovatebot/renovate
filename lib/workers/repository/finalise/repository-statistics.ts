import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { PrState } from '../../../types';

type PrStats = {
  total: number;
  open: number;
  closed: number;
  merged: number;
};

function initStats(): PrStats {
  return {
    total: 0,
    open: 0,
    closed: 0,
    merged: 0,
  };
}

// eslint-disable-next-line require-await,@typescript-eslint/require-await
export async function runRenovateRepoStats(
  config: RenovateConfig,
  prList: Pr[]
): Promise<void> {
  const prStats = initStats();

  for (const pr of prList) {
    if (
      pr.title === 'Configure Renovate' ||
      pr.title === config.onboardingPrTitle
    ) {
      continue;
    }
    prStats.total += 1;
    switch (pr.state) {
      case PrState.Merged:
        prStats.merged += 1;
        break;
      case PrState.Closed:
        prStats.closed += 1;
        break;
      case PrState.Open:
        prStats.open += 1;
        break;
      // istanbul ignore next: exclude PrState.All & .NotOpen
      default:
        break;
    }
  }
  logger.debug({ stats: prStats }, `Renovate repository PR statistics`);
}
