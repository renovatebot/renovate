import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getPrCache } from '../../../modules/platform/github/pr';
import { PrState } from '../../../types';
import { GithubHttp } from '../../../util/http/github';

const githubApi = new GithubHttp();
const renovateBot = 'renovate[bot]';

type PrStats = {
  created: number;
  open: number;
  closed: number;
  merged: number;
};

function initStats(): PrStats {
  return {
    created: 0,
    open: 0,
    closed: 0,
    merged: 0,
  };
}

export async function runRenovateRepoStats(
  config: RenovateConfig
): Promise<void> {
  const prStats = initStats();
  const prCache = await getPrCache(
    githubApi,
    config.repository ?? '',
    renovateBot
  );
  const prList = Object.values(prCache);
  for (const pr of prList) {
    if (
      pr.title === 'Configure Renovate' ||
      pr.title === config.onboardingPrTitle
    ) {
      continue;
    }
    prStats.created += 1;
    if (pr.state === PrState.Merged) {
      prStats.merged += 1;
    }
    if (pr.state === PrState.Closed) {
      prStats.closed += 1;
    }
    if (pr.state === PrState.Open) {
      prStats.open += 1;
    }
  }
  logger.info(
    { repo: config.repository, stats: prStats },
    `Renovate repository PR statistics`
  );
}
