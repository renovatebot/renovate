import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs, getBranchCommit } from '../../../util/git';
import { PackageFiles } from '../package-files';
import { validateReconfigureBranch } from '../reconfigure';
import { pruneStaleBranches } from './prune';
import {
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics';

export async function calculateScmStats(config: RenovateConfig): Promise<void> {
  const defaultBranchSha = getBranchCommit(config.defaultBranch!);
  // istanbul ignore if: shouldn't happen
  if (!defaultBranchSha) {
    logger.debug('No default branch sha found');
  }
  const repoCache = repositoryCache.getCache();
  if (repoCache.repoStats?.scm.defaultBranchSha === defaultBranchSha) {
    logger.debug('Default branch sha unchanged - scm stats are up to date');
  } else {
    logger.debug('Recalculating repo scm stats');
    const repoStats = await scm.getStats();
    if (repoStats) {
      repoCache.repoStats = { scm: repoStats };
    } else {
      logger.debug(`Could not calcualte repo stats`);
    }
  }
}

// istanbul ignore next
export async function finalizeRepo(
  config: RenovateConfig,
  branchList: string[],
): Promise<void> {
  await validateReconfigureBranch(config);
  await calculateScmStats(config);
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
    )
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
