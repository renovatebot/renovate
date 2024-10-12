import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs, hasCommittedTo } from '../../../util/git';
import { PackageFiles } from '../package-files';
import { validateReconfigureBranch } from '../reconfigure';
import { pruneStaleBranches } from './prune';
import {
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics';

// istanbul ignore next
export async function finalizeRepo(
  config: RenovateConfig,
  branchList: string[],
): Promise<void> {
  await validateReconfigureBranch(config);
  await repositoryCache.saveCache();
  await pruneStaleBranches(config, branchList);
  await ensureIssuesClosing();
  await clearRenovateRefs();
  PackageFiles.clear();
  const prList = await platform.getPrList();
  if (
    prList?.some(
      (pr) =>
        pr.state === 'merged' &&
        pr.title !== 'Configure Renovate' &&
        pr.title !== config.onboardingPrTitle &&
        pr.sourceBranch !== config.onboardingBranch,
    ) ||
    (await hasCommittedTo(config.baseBranches!))
  ) {
    logger.debug('Repo is activated');
    config.repoIsActivated = true;
  }
  runBranchSummary(config);
  runRenovateRepoStats(config, prList);
}

// istanbul ignore next
function ensureIssuesClosing(): Promise<Awaited<void>[]> {
  return Promise.all([
    platform.ensureIssueClosing(`Action Required: Fix Renovate Configuration`),
    platform.ensureIssueClosing(`Action Required: Add missing credentials`),
  ]);
}
