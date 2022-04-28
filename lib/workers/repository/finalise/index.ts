import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs } from '../../../util/git';
import { pruneStaleBranches } from './prune';
import { runRenovateRepoStats } from './repository-statistics';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  await repositoryCache.saveCache();
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
  await clearRenovateRefs();
  const prList = await platform.getPrList();
  if (
    prList?.some(
      (pr) =>
        pr.state === 'merged' &&
        (pr.title !== 'Configure Renovate' ||
          pr.title !== config.onboardingPrTitle)
    )
  ) {
    logger.info('Repo is activated');
    config.repoIsActivated = true;
  }
  await runRenovateRepoStats(config, prList);
}
